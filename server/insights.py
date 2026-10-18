"""Deterministic usage aggregates; no model calls or inferred personal traits."""
from collections import Counter, defaultdict
from datetime import datetime, timedelta
import json
import re
from zoneinfo import ZoneInfo
from archive import content_text, timestamp

TOPICS = {
    'Code & development': r'\b(code|coding|python|javascript|typescript|react|api|debug|github|git|sql|app|apps|website|software|programming|swift|css|html|server|database|deploy|bug|implementation)\b',
    'Learning & research': r'\b(learn|learning|study|studying|math|maths|calculus|explain|research|exam|course|class|classes|homework|physics|chemistry|science|university|school|quiz|lesson)\b',
    'Writing & communication': r'\b(write|writing|rewrite|email|draft|essay|proofread|grammar|translate|translation|resume|cover letter|summarize|summary|message)\b',
    'Travel & places': r'\b(travel|trip|flight|flights|hotel|hotels|airport|itinerary|visa|tour|vacation|restaurant|restaurants|auckland|christchurch|sydney|melbourne|san francisco|new zealand)\b',
    'Design & creativity': r'\b(design|image|images|photo|photos|logo|illustration|art|creative|color|colour|font|animation|figma|ui|ux|video|music)\b',
    'Everyday questions': r'\b(food|cook|cooking|recipe|recipes|buy|shopping|weather|phone|laptop|car|clothes|coffee|clean|repair|fix|best|compare)\b',
}
STOP = set('the a an and or to of for in on with how what why is are can do i my me you your it this that from by as at be about into make get help using use need want please have has will would should could does not all any some more new best'.split())


def build_insights(db, timezone='Pacific/Auckland', source='both'):
    tz = ZoneInfo(timezone)
    groups = defaultdict(list)
    groups['all'] = []
    kinds = {'both': ('conversations', 'codex'), 'chatgpt': ('conversations',), 'codex': ('codex',)}[source]
    for row in db.execute("SELECT id,title,kind,raw FROM records WHERE kind IN (%s)" % ','.join('?' for _ in kinds), kinds):
        raw = json.loads(row['raw'])
        # Active branch only: generated alternatives aren't additional human activity.
        nodes = raw.get('mapping', {})
        current, seen, path = raw.get('current_node'), set(), []
        while current and current in nodes and current not in seen:
            seen.add(current)
            path.append(nodes[current])
            current = nodes[current].get('parent')
        if not path:
            path = list(nodes.values())
        msgs = []
        for node in reversed(path):
            m = node.get('message')
            if not m or m.get('author', {}).get('role') not in ('user', 'assistant'):
                continue
            if m.get('metadata', {}).get('is_visually_hidden_from_conversation'):
                continue
            stamp = timestamp(m.get('create_time'))
            text = content_text(m.get('content'))
            if not text and not (m.get('content') or {}).get('parts'):
                continue
            msgs.append({'role': m['author']['role'], 'text': text, 'stamp': stamp,
                         'model': m.get('metadata', {}).get('model_slug') or raw.get('default_model_slug') or 'Unknown'})
        if row['kind'] == 'codex':
            msgs = []
            for turn in raw.get('turns', []):
                for item in turn.get('input_items', []) + turn.get('output_items', []):
                    if item.get('type') != 'message' or item.get('role') not in ('user', 'assistant'):
                        continue
                    text = content_text(item.get('content'))
                    if not text and not item.get('content'):
                        continue
                    msgs.append({'role': item['role'], 'text': text,
                                 'stamp': timestamp(item.get('create_time') or turn.get('create_time')),
                                 'model': item.get('model') or turn.get('model') or 'Unknown'})
        created = timestamp(raw.get('create_time')) or next((m['stamp'] for m in msgs if m['stamp']), 0)
        year = str(datetime.fromtimestamp(created, tz).year) if created else 'Unknown'
        record = {'id': row['id'], 'kind': row['kind'], 'title': row['title'], 'created': created, 'messages': msgs,
                  'model': raw.get('default_model_slug') or 'Unknown'}
        groups['all'].append(record)
        # Annual metrics use message timestamps; chats count if created or active that year.
        years = {str(datetime.fromtimestamp(m['stamp'], tz).year) for m in msgs if m['stamp']}
        if year != 'Unknown':
            years.add(year)
        for y in years:
            groups[y].append({**record, 'messages': [m for m in msgs if m['stamp'] and str(datetime.fromtimestamp(m['stamp'], tz).year) == y]})
    result = {'years': sorted((k for k in groups if k != 'all'), reverse=True), 'timezone': timezone, 'undatedConversations': sum(not r['created'] and not any(m['stamp'] for m in r['messages']) for r in groups['all']), 'periods': {}}
    for period, records in groups.items():
        daily, hours, weekdays, models, topics, words, monthly = Counter(), Counter(), Counter(), Counter(), Counter(), Counter(), Counter()
        user_count = assistant_count = word_count = 0
        times = []
        longest = []
        topic_examples = defaultdict(list)
        for record in records:
            msgs = record['messages']
            user_msgs = [m for m in msgs if m['role'] == 'user']
            longest.append({'id': record['id'], 'kind': record['kind'], 'title': record['title'], 'count': len(msgs), 'prompts': len(user_msgs)})
            # Transparent title keyword matching; categories can overlap.
            for topic, pattern in TOPICS.items():
                if re.search(pattern, record['title'], re.I):
                    topics[topic] += 1
                    topic_examples[topic].append({'id': record['id'], 'kind': record['kind'], 'title': record['title']})
            words.update(set(w for w in re.findall(r'[a-z]{3,}', record['title'].lower()) if w not in STOP))
            for m in msgs:
                if m['role'] == 'assistant':
                    assistant_count += 1
                    models[m['model']] += 1
                else:
                    user_count += 1
                    word_count += len(m['text'].split())
                if m['stamp']:
                    dt = datetime.fromtimestamp(m['stamp'], tz)
                    times.append(m['stamp'])
                    if m['role'] == 'user':
                        daily[dt.strftime('%Y-%m-%d')] += 1
                        monthly[dt.strftime('%Y-%m')] += 1
                        hours[dt.hour] += 1
                        weekdays[dt.weekday()] += 1
        streak = run = 0
        previous = None
        for day in sorted(daily):
            date = datetime.fromisoformat(day)
            run = run + 1 if previous and date - previous == timedelta(days=1) else 1
            streak = max(streak, run)
            previous = date
        if monthly:
            start = datetime.strptime(min(monthly), '%Y-%m')
            end = datetime.strptime(max(monthly), '%Y-%m')
            while start <= end:
                monthly.setdefault(start.strftime('%Y-%m'), 0)
                start = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
        peak_day = daily.most_common(1)
        result['periods'][period] = {
            'conversations': len(records), 'messages': user_count + assistant_count,
            'prompts': user_count, 'responses': assistant_count, 'words': word_count,
            'activeDays': len(daily), 'streak': streak,
            'undatedPrompts': sum(m['role'] == 'user' and not m['stamp'] for r in records for m in r['messages']),
            'first': min(times) if times else 0, 'last': max(times) if times else 0,
            'peakHour': hours.most_common(1)[0][0] if hours else None,
            'peakWeekday': weekdays.most_common(1)[0][0] if weekdays else None,
            'peakDay': {'date': peak_day[0][0], 'count': peak_day[0][1]} if peak_day else None,
            'monthly': [{'month': k, 'count': v} for k,v in sorted(monthly.items())],
            'hours': [{'hour': h, 'count': hours[h]} for h in range(24)],
            'daily': dict(daily),
            'models': [{'name': k, 'count': v} for k,v in models.most_common(8)],
            'topics': [{'name': k, 'count': v, 'examples': topic_examples[k][:10]} for k,v in topics.most_common()],
            'wordsUsed': [{'name': k, 'count': v} for k,v in words.most_common(12)],
            'longest': sorted(longest, key=lambda x: x['count'], reverse=True)[:5],
        }
    return result
