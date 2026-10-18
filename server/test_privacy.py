import json
import sqlite3
import unittest
from privacy import build_privacy


class PrivacyTests(unittest.TestCase):
    def test_citation_formats_and_missing_account_data(self):
        db = sqlite3.connect(':memory:')
        db.row_factory = sqlite3.Row
        db.execute('CREATE TABLE records(id TEXT,title TEXT,kind TEXT,raw TEXT)')
        metadata = {'conversation_context_citation_metadata': [
            {'citation': {'conversation_context_type': 'general_memory', 'snippet': 'Prefers Python'}},
            {'citation': {'category': 'memory', 'attribution': 'Past chat'}},
            {'citation': {'conversation_context_type': 'past_conversation'}},
            {'citation': {'type': 'other'}},
        ], 'suggested_context_scope': 'HEALTH'}
        raw = {'mapping': {k: {'message': {'metadata': metadata}} for k in ['a', 'b']}}
        db.execute('INSERT INTO records VALUES(?,?,?,?)', ('chat', 'Example', 'conversations', json.dumps(raw)))
        result = build_privacy(db)
        self.assertEqual(result['memory']['messages'], 2)
        self.assertEqual(result['memory']['conversations'], 1)
        self.assertEqual(result['memory']['types']['past_conversation'], 4)
        self.assertEqual(len(result['memory']['examples']), 1)
        self.assertEqual(result['suggestions']['messages'], 2)
        self.assertEqual(len(result['suggestions']['examples']), 1)
        self.assertEqual(result['files']['total'], 0)
        self.assertEqual(result['shares']['anonymous'], 0)
