import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js'
import { demoArchive } from '../src/lib/archive/demo'
import { buildInsights } from '../src/lib/archive/insights'
import { importFile } from '../src/lib/archive/import'
import { addJSON, type ArchiveRecord } from '../src/lib/archive/model'
const conversation={id:'fixture',title:'Learn physics',create_time:Date.parse('2025-12-31T11:30:00Z')/1000,current_node:'reply',mapping:{prompt:{parent:null,message:{author:{role:'user'},create_time:Date.parse('2025-12-31T11:30:00Z'),content:{parts:['Explain gravity']}}},reply:{parent:'prompt',message:{author:{role:'assistant'},create_time:Date.parse('2025-12-31T11:31:00Z'),content:{parts:['Gravity curves spacetime.']},metadata:{model_slug:'test-model'}}},alternative:{parent:'prompt',message:{author:{role:'assistant'},content:{parts:['An alternative.']}}}}}
test('active branch metrics, millisecond timestamps and Auckland year boundary',()=>{const rows:ArchiveRecord[]=[];addJSON(rows,'conversations.json',[conversation]);const insights=buildInsights(rows,'both');assert.equal(insights.periods.all.messages,2);assert.equal(rows[0].messages.length,3);assert.deepEqual(insights.years,['2026']);assert.equal(insights.periods['2026'].prompts,1);assert.equal(insights.periods.all.models[0].name,'test-model')})
test('demo is deterministic, contains both sources and has consistent totals',()=>{const a=demoArchive(),b=demoArchive();assert.deepEqual(a,b);assert.equal(a.demo,true);const both=buildInsights(a.records,'both').periods.all,chat=buildInsights(a.records,'chatgpt').periods.all,codex=buildInsights(a.records,'codex').periods.all;assert.equal(both.conversations,240);assert.equal(both.messages,chat.messages+codex.messages);assert.ok(codex.messages>0);assert.ok(a.files.length>0)})
test('JSON import accepts standard exports, rejects unrelated and malformed JSON',async()=>{const ok=await importFile(new File([JSON.stringify([conversation])],'conversations.json'),()=>{});assert.equal(ok.archive.records.length,1);await assert.rejects(importFile(new File(['{}'],'unrelated.json'),()=>{}),/No conversations/);await assert.rejects(importFile(new File(['{'],'broken.json'),()=>{}));await assert.rejects(importFile(new File(['a'],'archive.txt'),()=>{}),/\.zip or .json/)})
test('ZIP folder prefix, file access and missing privacy records',async()=>{const writer=new ZipWriter(new BlobWriter());await writer.add('export/conversations.json',new TextReader(JSON.stringify([conversation])));await writer.add('export/notes.txt',new TextReader('Fictional notes'));const blob=await writer.close();const result=await importFile(new File([blob],'export.zip'),()=>{});assert.equal(result.archive.records[0].title,'Learn physics');assert.equal(await (await result.getFile('notes.txt')).text(),'Fictional notes');assert.equal(result.archive.files.length,2)})
test('empty source has all-time period and safe zero metrics',()=>{const empty=buildInsights([],'codex');assert.equal(empty.periods.all.messages,0);assert.equal(empty.periods.all.first,0);assert.equal(empty.periods.all.peakHour,null);assert.deepEqual(empty.years,[])})

test('streamed JSON handles wrapped arrays, UTF-8 boundaries and missing IDs',async()=>{
  const { jsonSink } = await import('../src/lib/archive/json-stream')
  for(const wrap of [false,true]) {
    const records:ArchiveRecord[]=[]
    const rows=[{title:'🌱 "quoted" \\ path',mapping:{}},{title:'Second',mapping:{}}]
    const data=new TextEncoder().encode(JSON.stringify(wrap?{conversations:rows}:rows))
    const writer=jsonSink(records,'conversations.json').getWriter()
    for(let i=0;i<data.length;i+=3)await writer.write(data.slice(i,i+3))
    await writer.close()
    assert.equal(records.length,2)
    assert.equal(records[0].title,rows[0].title)
    assert.notEqual(records[0].id,records[1].id)
  }
})
test('streamed import rejects truncated JSON rather than accepting partial records',async()=>{
  await assert.rejects(importFile(new File(['[{"id":"one","mapping":{}},'],'conversations.json'),()=>{}))
})
