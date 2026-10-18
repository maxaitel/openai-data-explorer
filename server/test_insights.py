import json
import sqlite3
import unittest
from datetime import datetime
from zoneinfo import ZoneInfo
from archive import timestamp
from insights import build_insights

class InsightsTests(unittest.TestCase):
    def test_milliseconds(self):
        self.assertEqual(timestamp(1760000000000), 1760000000)
        self.assertEqual(timestamp(1760000000), 1760000000)

    def test_sources_and_undated_codex(self):
        db = sqlite3.connect(':memory:')
        db.row_factory = sqlite3.Row
        db.execute('CREATE TABLE records(id TEXT,title TEXT,raw TEXT,kind TEXT)')
        codex = {'turns': [
            {'role': 'user', 'input_items': [{'type': 'message', 'role': 'user', 'content': [{'text': 'Build a site'}]}, {'type': 'slack_context', 'content': 'duplicate context'}]},
            {'role': 'assistant', 'output_items': [{'type': 'message', 'role': 'assistant', 'content': [{'text': 'Done'}]}, {'type': 'pr', 'content': 'not a message'}, {'type': 'partial_repo_snapshot', 'files': []}]},
        ]}
        chat = {'create_time': 1760000000, 'mapping': {'a': {'message': {'author': {'role': 'user'}, 'content': {'parts': ['hello']}, 'create_time': 1760000000}}}}
        for ident, kind, raw in [('c', 'codex', codex), ('g', 'conversations', chat)]:
            db.execute('INSERT INTO records VALUES(?,?,?,?)', (ident, 'Build app', json.dumps(raw), kind))
        both = build_insights(db)
        code = build_insights(db, source='codex')
        gpt = build_insights(db, source='chatgpt')
        self.assertEqual(both['periods']['all']['messages'], 3)
        self.assertEqual(code['periods']['all']['messages'], 2)
        self.assertEqual(gpt['periods']['all']['messages'], 1)
        self.assertEqual(code['periods']['all']['words'], 3)
        self.assertEqual(code['periods']['all']['undatedPrompts'], 1)
        self.assertEqual(code['undatedConversations'], 1)
        self.assertEqual(code['periods']['all']['daily'], {})
        self.assertEqual(code['years'], [])
        self.assertEqual(both['periods']['2025']['conversations'], 1)
        self.assertEqual(code['periods']['all']['longest'][0]['kind'], 'codex')
        self.assertEqual(code['periods']['all']['topics'][0]['examples'][0]['kind'], 'codex')
        db.execute('DELETE FROM records')
        self.assertEqual(build_insights(db)['periods']['all']['messages'], 0)

    def test_branch_year_and_streak(self):
        db = sqlite3.connect(':memory:')
        db.row_factory = sqlite3.Row
        db.execute('CREATE TABLE records(id TEXT,title TEXT,raw TEXT,kind TEXT)')
        def stamp(s):
            return datetime.fromisoformat(s).replace(tzinfo=ZoneInfo('Pacific/Auckland')).timestamp()
        def node(role, at, parent=None, model=None):
            return {'parent': parent, 'message': {'author': {'role': role}, 'create_time': at, 'content': {'parts': ['hello there']}, 'metadata': {'model_slug': model}}}
        raw = {'create_time': stamp('2025-12-31T23:00:00'), 'default_model_slug': 'fallback', 'current_node': 'c', 'mapping': {
            'a': node('user', stamp('2025-12-31T23:00:00')),
            'b': node('assistant', stamp('2025-12-31T23:01:00'), 'a', 'actual'),
            'c': node('user', stamp('2026-01-01T01:00:00') * 1000, 'b'),
            'discarded': node('user', stamp('2026-01-03T01:00:00'), 'a'),
        }}
        db.execute('INSERT INTO records VALUES(?,?,?,?)', ('1', 'Python API', json.dumps(raw), 'conversations'))
        result = build_insights(db)
        all_time = result['periods']['all']
        self.assertEqual(all_time['messages'], 3)
        self.assertEqual(all_time['prompts'], 2)
        self.assertEqual(all_time['streak'], 2)
        self.assertEqual(all_time['models'], [{'name': 'actual', 'count': 1}])
        self.assertEqual(all_time['topics'][0]['name'], 'Code & development')
        self.assertEqual(result['periods']['2025']['messages'], 2)
        self.assertEqual(result['periods']['2026']['messages'], 1)
        self.assertEqual(sum(x['count'] for x in all_time['monthly']), 2)
        self.assertEqual(sum(all_time['daily'].values()), 2)

if __name__ == '__main__':
    unittest.main()
