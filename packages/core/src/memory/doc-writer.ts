import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { GuideConfig, DEFAULT_CONFIG, ParsedBrief, MissionMap } from '../types.js';

export class DocWriter {
  private guideDir: string;

  constructor(config: Partial<GuideConfig> = {}) {
    const merged = { ...DEFAULT_CONFIG, ...config };
    this.guideDir = join(merged.projectRoot, merged.guideDir);
  }

  async init(): Promise<void> {
    await mkdir(this.guideDir, { recursive: true });
  }

  async writeBrief(rawBrief: string): Promise<void> {
    await writeFile(join(this.guideDir, 'brief.md'), rawBrief);
  }

  async writeArchitecture(brief: ParsedBrief): Promise<void> {
    const lines = [
      '# Architecture',
      '',
      `**Project**: ${brief.projectName}`,
      `**Language**: ${brief.stack.language}`,
      brief.stack.framework ? `**Framework**: ${brief.stack.framework}` : null,
      brief.stack.database ? `**Database**: ${brief.stack.database}` : null,
      brief.stack.auth ? `**Auth**: ${brief.stack.auth}` : null,
      brief.stack.styling ? `**Styling**: ${brief.stack.styling}` : null,
      brief.stack.deployment ? `**Deployment**: ${brief.stack.deployment}` : null,
      brief.stack.extras.length > 0 ? `**Extras**: ${brief.stack.extras.join(', ')}` : null,
      '',
      `**Complexity**: ${brief.complexity}`,
      '',
      '## Features',
      ...brief.features.map(f => `- ${f}`),
      '',
      brief.constraints.length > 0 ? '## Constraints' : null,
      ...brief.constraints.map(c => `- ${c}`),
    ].filter(Boolean);

    await writeFile(join(this.guideDir, 'architecture.md'), lines.join('\n'));
  }

  async appendDecision(decision: string, reason: string): Promise<void> {
    const path = join(this.guideDir, 'decisions.md');
    let existing = '';
    try {
      existing = await readFile(path, 'utf-8');
    } catch {
      existing = '# Decisions\n\n';
    }

    const entry = `### ${new Date().toISOString().slice(0, 19)}\n**Decision**: ${decision}\n**Reason**: ${reason}\n\n`;
    await writeFile(path, existing + entry);
  }

  async writeMissionMap(map: MissionMap): Promise<void> {
    const lines = [
      '# Mission Map',
      '',
      `**Project**: ${map.projectName}`,
      `**Intent**: ${map.intent}`,
      `**Total Missions**: ${map.totalMissions}`,
      `**Current**: Mission ${map.currentMission}`,
      '',
      ...map.missions.map(m => {
        const statusIcon = { locked: '🔒', active: '▶️', complete: '✅', skipped: '⏭️' }[m.status];
        const taskList = m.tasks.length > 0
          ? '\n' + m.tasks.map(t => `    - ${t}`).join('\n')
          : '';
        return `- ${statusIcon} **${m.name}** — ${m.goal}${taskList}`;
      }),
    ];

    await writeFile(join(this.guideDir, 'missions.md'), lines.join('\n'));
  }
}
