"""Privacy findings from exported records, including alternate message branches."""
import json
from collections import Counter


def build_privacy(db):
    def account(name, default):
        row = db.execute('SELECT raw FROM records WHERE id=?', (name,)).fetchone()
        return json.loads(row['raw']) if row else default

    memory_messages = 0
    memory_chats = set()
    types = Counter()
    memory_examples = []
    seen_examples = set()
    suggestions = []
    for row in db.execute("SELECT id,title,raw FROM records WHERE kind='conversations' ORDER BY id"):
        raw = json.loads(row['raw'])
        for node in raw.get('mapping', {}).values():
            meta = (node.get('message') or {}).get('metadata', {})
            citations = meta.get('conversation_context_citation_metadata') or []
            if citations:
                memory_messages += 1
                memory_chats.add(row['id'])
            for entry in citations:
                citation = entry.get('citation') or {}
                kind = citation.get('conversation_context_type')
                # Older exports label past-chat references with category/attribution instead.
                if not kind and citation.get('category') == 'memory' and citation.get('attribution') == 'Past chat':
                    kind = 'past_conversation'
                types[kind or 'other'] += 1
                snippet = citation.get('snippet')
                if kind == 'general_memory' and snippet and snippet not in seen_examples and len(memory_examples) < 6:
                    seen_examples.add(snippet)
                    memory_examples.append({'id': row['id'], 'title': row['title'], 'snippet': snippet,
                                            'reason': citation.get('reason')})
            if meta.get('suggested_context_scope'):
                suggestions.append({'id': row['id'], 'title': row['title'], 'scope': meta['suggested_context_scope'],
                                    'label': meta.get('suggested_context_scope_action_label')})
    files = account('library_files.json', [])
    shares = account('shared_conversations.json', [])
    return {
        'memory': {'messages': memory_messages, 'conversations': len(memory_chats), 'types': dict(types), 'examples': memory_examples},
        'files': {'total': len(files), 'linkedToMessages': sum(bool(f.get('origination_message_id') and f.get('origination_thread_id')) for f in files),
                  'fingerprints': sum(bool(f.get('sha256_digest')) for f in files),
                  'renamed': sum(bool(f.get('user_renamed_at')) for f in files),
                  'deleted': sum(bool(f.get('deleted_at')) for f in files), 'trashed': sum(bool(f.get('trashed_at')) for f in files)},
        'shares': {'total': len(shares), 'anonymous': sum(s.get('is_anonymous') is True for s in shares)},
        'suggestions': {'messages': len(suggestions), 'conversations': len({s['id'] for s in suggestions}),
                        'examples': list({(s['id'], s['scope']): s for s in suggestions}.values())[:6]},
    }
