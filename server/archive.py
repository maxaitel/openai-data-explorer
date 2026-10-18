"""Local, read-only ZIP explorer. The archive is never extracted or executed."""
import argparse
import datetime
import json
import mimetypes
import os
from pathlib import Path
import re
import sqlite3
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse, quote

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / '.data'
DB = DATA / 'archive.sqlite'
CONFIG = DATA / 'config.json'


def connect():
    db = sqlite3.connect(DB)
    db.row_factory = sqlite3.Row
    return db


def timestamp(value):
    if isinstance(value, (int, float)):
        return value / 1000 if value > 100_000_000_000 else value
    try:
        return datetime.datetime.fromisoformat(value.replace('Z', '+00:00')).timestamp()
    except (ValueError, AttributeError, TypeError):
        return 0


def content_text(value):
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return '\n'.join(filter(None, (content_text(x) for x in value)))
    if isinstance(value, dict):
        if isinstance(value.get('text'), str):
            return value['text']
        for key in ['parts', 'content', 'transcript', 'result', 'output']:
            if key in value:
                return content_text(value[key])
        if value.get('asset_pointer'):
            return '[Attachment: ' + value['asset_pointer'] + ']'
    return ''


def messages(record):
    if 'mapping' in record:
        nodes = record['mapping']
        path, seen = [], set()
        current = record.get('current_node')
        while current and current in nodes and current not in seen:
            seen.add(current)
            path.append(current)
            current = nodes[current].get('parent')
        path.reverse()
        # Preserve alternate branches after the active conversation.
        order = path + sorted((k for k in nodes if k not in seen), key=lambda k: timestamp((nodes[k].get('message') or {}).get('create_time')))
        output = []
        for key in order:
            msg = nodes[key].get('message')
            if not msg:
                continue
            text = content_text(msg.get('content'))
            if not text:
                continue
            output.append({'id': key, 'role': msg.get('author', {}).get('role', 'unknown'), 'text': text,
                           'time': timestamp(msg.get('create_time')), 'alternate': bool(path) and key not in seen})
        return output
    output = []
    for turn in record.get('turns', []):
        for item in turn.get('input_items', []) + turn.get('output_items', []):
            text = content_text(item)
            if not text:
                text = json.dumps(item, ensure_ascii=False, indent=2)
            output.append({'id': str(len(output)), 'role': item.get('role', turn.get('role', 'tool')),
                           'text': text, 'time': 0, 'alternate': False})
    return output


def import_archive(path):
    DATA.mkdir(exist_ok=True)
    temp = DATA / 'import.sqlite'
    temp.unlink(missing_ok=True)
    db = sqlite3.connect(temp)
    db.executescript('''
        CREATE TABLE records(id TEXT PRIMARY KEY, kind TEXT, title TEXT, model TEXT, updated REAL, count INTEGER, source TEXT, raw TEXT);
        CREATE INDEX record_kind ON records(kind, updated DESC);
        CREATE VIRTUAL TABLE search USING fts5(id UNINDEXED, title, body, tokenize='unicode61');
        CREATE TABLE files(path TEXT PRIMARY KEY, name TEXT, size INTEGER, mime TEXT);
        CREATE TABLE meta(key TEXT PRIMARY KEY, value TEXT);
    ''')
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        asset_names = json.loads(archive.read('conversation_asset_file_names.json')) if 'conversation_asset_file_names.json' in names else {}
        def add(ident, kind, title, model, updated, count, source, raw, body):
            db.execute('INSERT INTO records VALUES(?,?,?,?,?,?,?,?)', (ident, kind, title, model or '', timestamp(updated), count, source, json.dumps(raw, ensure_ascii=False)))
            db.execute('INSERT INTO search VALUES(?,?,?)', (ident, title, body))
        for info in archive.infolist():
            if info.is_dir():
                continue
            name = asset_names.get(info.filename, info.filename.rsplit('/', 1)[-1])
            mime = mimetypes.guess_type(name)[0] or 'application/octet-stream'
            db.execute('INSERT INTO files VALUES(?,?,?,?)', (info.filename, name, info.file_size, mime))
        for index, name in enumerate(names):
            if not name.endswith('.json'):
                continue
            raw = json.loads(archive.read(name))
            if re.match(r'(conversations|codex)-\d+\.json$', name):
                kind = 'conversations' if name.startswith('conversations') else 'codex'
                for i, record in enumerate(raw):
                    msgs = messages(record)
                    add(kind + ':' + str(record.get('id', i)), kind, record.get('title') or 'Untitled', record.get('default_model_slug'),
                        record.get('update_time', record.get('create_time')), len(msgs), name, record, '\n'.join(m['text'] for m in msgs))
            elif name.startswith('pages/') and name.endswith('/content/current.json'):
                projection = raw.get('projection') or {}
                meta_path = name.replace('content/current.json', 'metadata.json')
                meta = json.loads(archive.read(meta_path)) if meta_path in names else {}
                title = projection.get('title') or projection.get('name') or meta.get('title') or meta.get('page_id', 'Page')
                if not isinstance(title, str):
                    title = json.dumps(title)
                body = projection.get('materialized_search_text') or content_text(projection)
                add(name, 'pages', title, '', meta.get('updated_at'), 0, name, raw, body)
            else:
                kind = 'sites' if name.startswith('sites/') else 'account' if '/' not in name else 'other'
                title = name
                add(name, kind, title, '', 0, len(raw) if isinstance(raw, (dict, list)) else 1, name, raw, json.dumps(raw, ensure_ascii=False))
            if index % 30 == 0:
                print(f'Indexed {index + 1}/{len(names)} archive entries', flush=True)
        db.execute('INSERT INTO meta VALUES(?,?)', ('archive', json.dumps({'name': Path(path).name, 'files': len(names), 'bytes': sum(x.file_size for x in archive.infolist())})))
    db.commit()
    print(dict(db.execute('SELECT kind, count(*) FROM records GROUP BY kind').fetchall()), flush=True)
    db.close()
    os.replace(temp, DB)
    CONFIG.write_text(json.dumps({'archive': str(Path(path).resolve())}))


class Handler(BaseHTTPRequestHandler):
    def json_response(self, value, status=200):
        payload = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        try:
            self.route()
        except (BrokenPipeError, ConnectionResetError):
            pass
        except (ValueError, KeyError) as error:
            self.json_response({'error': str(error)}, 400)
        except Exception as error:
            print(type(error).__name__, str(error), flush=True)
            self.json_response({'error': 'Unable to read archive data.'}, 500)

    def route(self):
        url = urlparse(self.path)
        query = {k: v[0] for k, v in parse_qs(url.query).items()}
        if not url.path.startswith('/api/'):
            return self.json_response({'error': 'Not found'}, 404)
        if not DB.exists():
            return self.json_response({'error': 'Import an archive first with npm run import -- /path/to/export.zip'}, 503)
        with connect() as db:
            if url.path == '/api/insights':
                cached = DATA / 'insights-v2.json'
                if not cached.exists() or cached.stat().st_mtime < DB.stat().st_mtime:
                    from insights import build_insights
                    cached.write_text(json.dumps({'sources': {source: build_insights(db, source=source) for source in ('both', 'chatgpt', 'codex')}}))
                return self.json_response(json.loads(cached.read_text()))
            if url.path == '/api/privacy':
                from privacy import build_privacy
                cached = DATA / 'privacy-v1.json'
                if not cached.exists() or cached.stat().st_mtime < DB.stat().st_mtime:
                    cached.write_text(json.dumps(build_privacy(db)))
                return self.json_response(json.loads(cached.read_text()))
            if url.path == '/api/stats':
                return self.json_response({'counts': dict(db.execute('SELECT kind, count(*) FROM records GROUP BY kind').fetchall()),
                    'archive': json.loads(db.execute("SELECT value FROM meta WHERE key='archive'").fetchone()[0]),
                    'models': [r[0] for r in db.execute("SELECT DISTINCT model FROM records WHERE model != '' ORDER BY model")]})
            if url.path == '/api/records':
                kind = query.get('kind', 'conversations')
                page = max(0, int(query.get('page', 0)))
                where, args = ['r.kind = ?'], [kind]
                search = query.get('q', '').strip()
                if search:
                    terms = re.findall(r'\w+', search, flags=re.UNICODE)
                    if terms:
                        where.append('r.id IN (SELECT id FROM search WHERE search MATCH ?)')
                        args.append(' AND '.join('"' + term + '"*' for term in terms))
                    else:
                        where.append('r.title LIKE ?')
                        args.append('%' + search + '%')
                if query.get('model'):
                    where.append('r.model = ?')
                    args.append(query['model'])
                condition = ' AND '.join(where)
                order = {'oldest': 'updated ASC', 'title': 'title COLLATE NOCASE ASC', 'messages': 'count DESC'}.get(query.get('sort'), 'updated DESC')
                count = db.execute('SELECT count(*) FROM records r WHERE ' + condition, args).fetchone()[0]
                rows = db.execute('SELECT id,kind,title,model,updated,count,source FROM records r WHERE ' + condition + ' ORDER BY ' + order + ', id LIMIT 50 OFFSET ?', args + [page * 50]).fetchall()
                return self.json_response({'items': [dict(r) for r in rows], 'total': count})
            if url.path == '/api/record':
                row = db.execute('SELECT * FROM records WHERE id=?', (query.get('id'),)).fetchone()
                if not row:
                    return self.json_response({'error': 'Record not found'}, 404)
                result = dict(row)
                raw = json.loads(result.pop('raw'))
                result.update(raw=raw, messages=messages(raw) if isinstance(raw, dict) else [], text=(raw.get('projection') or {}).get('materialized_search_text', '') if isinstance(raw, dict) else '')
                return self.json_response(result)
            if url.path == '/api/files':
                page = max(0, int(query.get('page', 0)))
                pattern = '%' + query.get('q', '') + '%'
                args = [pattern, pattern]
                condition = '(name LIKE ? OR path LIKE ?)'
                if query.get('type'):
                    condition += ' AND mime LIKE ?'
                    args.append(query['type'] + '%')
                total = db.execute('SELECT count(*) FROM files WHERE ' + condition, args).fetchone()[0]
                rows = db.execute('SELECT * FROM files WHERE ' + condition + ' ORDER BY name COLLATE NOCASE, path LIMIT 50 OFFSET ?', args + [page * 50]).fetchall()
                return self.json_response({'items': [dict(r) for r in rows], 'total': total})
            if url.path == '/api/file':
                row = db.execute('SELECT * FROM files WHERE path=?', (query.get('path'),)).fetchone()
                if not row:
                    return self.json_response({'error': 'File not found'}, 404)
                archive_path = json.loads(CONFIG.read_text())['archive']
                with zipfile.ZipFile(archive_path) as archive:
                    # Only inert media can be rendered inline. HTML/SVG exports are downloads.
                    safe = row['mime'] in ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'video/mp4', 'video/webm', 'application/pdf']
                    preview = query.get('preview') == '1'
                    if preview and not safe:
                        with archive.open(row['path']) as source:
                            data = source.read(200001)
                        return self.json_response({'text': data[:200000].decode('utf-8', errors='replace'), 'truncated': len(data) > 200000})
                    self.send_response(200)
                    self.send_header('Content-Type', row['mime'] if safe else 'application/octet-stream')
                    self.send_header('Content-Length', str(row['size']))
                    self.send_header('Content-Disposition', ('inline' if preview and safe else 'attachment') + "; filename*=UTF-8''" + quote(row['name'], safe=''))
                    self.send_header('X-Content-Type-Options', 'nosniff')
                    self.send_header('Content-Security-Policy', "sandbox; default-src 'none'")
                    self.end_headers()
                    with archive.open(row['path']) as source:
                        while chunk := source.read(1024 * 1024):
                            self.wfile.write(chunk)
                return
            return self.json_response({'error': 'Not found'}, 404)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=['import', 'serve'])
    parser.add_argument('archive', nargs='?')
    options = parser.parse_args()
    if options.command == 'import':
        if not options.archive:
            parser.error('Provide the path to an export ZIP')
        import_archive(options.archive)
    else:
        print('Archive API: http://127.0.0.1:4311', flush=True)
        ThreadingHTTPServer(('127.0.0.1', 4311), Handler).serve_forever()
