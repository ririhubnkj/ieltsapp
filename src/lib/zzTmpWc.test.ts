import { it } from 'vitest';
import { parsePresetTopics, parseMarkedText } from './presets';
import { parseTaskPrompts } from './presetLibrary';
import { checkEssay, task1TemplateId, task2TemplateId, stripMarks, task1QuestionFromEssay } from './writingCheck';
import { TEMPLATES } from './writingTemplates';
const raw = import.meta.glob<string>(['../data/levels/*/*.txt', '../data/band6/*.txt'], { query: '?raw', import: 'default', eager: true });
it('scan', () => {
  void parseMarkedText;
  for (const [path, text] of Object.entries(raw)) {
    const isT1 = path.endsWith('task1Topics.txt');
    const isT2 = path.endsWith('task2Models.txt');
    if (!isT1 && !isT2) continue;
    const prompts = isT2 ? parseTaskPrompts(raw[path.replace('task2Models', 'task2ModelPrompts')] ?? '', 'task2model-') : null;
    for (const t of parsePresetTopics(text, isT1 ? 'task1-' : 'task2model-')) {
      const essay = stripMarks(t.text);
      const tid = isT1 ? task1TemplateId(t.presetId, t.title) : task2TemplateId(prompts?.get(t.presetId)?.headers ?? []);
      const tpl = TEMPLATES[isT1 ? 'task1' : 'task2'].find((x) => x.id === tid);
      const items = checkEssay({ task: isT1 ? 'task1' : 'task2', text: essay, template: tpl });
      const bad = items.filter((i) => !i.ok).map((i) => `${i.label}: ${i.detail}`);
      console.log(path.replace('../data/', ''), t.presetId, tid, '\n   ', bad.join('\n    '));
      if (isT1) console.log('   Q:', task1QuestionFromEssay(t.text).slice(0, 90));
    }
  }
});
