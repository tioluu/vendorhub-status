import { Injectable, computed } from '@angular/core';
import { CheckResult, CheckState } from './check';
import { ALL_ENDPOINTS, ENDPOINT_GROUPS, Endpoint, EndpointGroup } from './endpoints';
import { ENVIRONMENTS, EnvId, Environment } from './environments';
import { FullTest } from './full-test';
import { HealthChecks, Overall } from './health-checks';

export interface GroupSummary {
  /** Drives the pill: the most important thing that happened in the group. */
  state: CheckState;
  passed: number;
  /** Checks that actually ran, i.e. passed or failed. */
  ran: number;
  skipped: number;
}

export interface Problem {
  env: Environment;
  endpoint: Endpoint;
  result: CheckResult;
}

/** Pill labels for a whole group, which read differently from a single row's. */
export const GROUP_LABELS: Record<CheckState, string> = {
  idle: 'Not run',
  checking: 'Checking',
  up: 'OK',
  failing: 'Failed',
  unreachable: 'Offline',
  skipped: 'Skipped',
  blocked: 'Read-only',
};

/**
 * Owns the checks and full tests for every environment and decides which result belongs to each
 * endpoint. The summary and the details view both read from here, so they can't disagree.
 */
@Injectable({ providedIn: 'root' })
export class StatusBoard {
  readonly checks = Object.fromEntries(
    ENVIRONMENTS.map((env) => [env.id, new HealthChecks(env)]),
  ) as Record<EnvId, HealthChecks>;

  /** The full test writes data, so read-only environments don't get one. */
  readonly tests = Object.fromEntries(
    ENVIRONMENTS.filter((env) => !env.readOnly).map((env) => [env.id, new FullTest(env)]),
  ) as Partial<Record<EnvId, FullTest>>;

  /** True once every environment has finished its first round of checks. */
  readonly ready = computed(() => ENVIRONMENTS.every((env) => this.checks[env.id].lastChecked() !== null));

  readonly offline = computed(() => ENVIRONMENTS.filter((env) => this.checks[env.id].overall() === 'offline'));

  /** Every failed endpoint on every environment that's up. An offline environment counts once, not per endpoint. */
  readonly problems = computed<Problem[]>(() =>
    ENVIRONMENTS.filter((env) => this.checks[env.id].overall() !== 'offline').flatMap((env) =>
      ALL_ENDPOINTS.map((endpoint) => ({ env, endpoint, result: this.resultFor(env, endpoint) })).filter(
        ({ result }) => result.state === 'failing' || result.state === 'unreachable',
      ),
    ),
  );

  checkAll(): void {
    ENVIRONMENTS.forEach((env) => this.checks[env.id].checkAll());
  }

  resultFor(env: Environment, ep: Endpoint): CheckResult {
    if (ep.probe) return this.checks[env.id].result(ep);
    const test = this.tests[env.id];
    return test ? test.result(ep) : { state: 'blocked' };
  }

  summarize(env: Environment, group: EndpointGroup): GroupSummary {
    const states = group.endpoints.map((ep) => this.resultFor(env, ep).state);
    const count = (...wanted: CheckState[]) => states.filter((state) => wanted.includes(state)).length;
    const passed = count('up');
    return {
      state: groupState(states, this.checks[env.id].overall()),
      passed,
      ran: passed + count('failing', 'unreachable'),
      skipped: count('skipped'),
    };
  }

  toMarkdown(now = new Date()): string {
    const time = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    const cell = (summary: GroupSummary) =>
      [GROUP_LABELS[summary.state], countsText(summary)].filter(Boolean).join(' · ');

    const testLines = ENVIRONMENTS.flatMap((env) => {
      const test = this.tests[env.id];
      if (!test) return [];
      const ran = test.lastRun();
      return ran
        ? [`Full test on ${env.name}: ${test.passed()} of ${test.total} steps passed (${time.format(ran)}).`]
        : [`Full test on ${env.name}: not run yet.`];
    });

    return [
      `## API status (${time.format(now)})`,
      '',
      `| Group | ${ENVIRONMENTS.map((env) => `${env.name} (\`${env.target}\`)`).join(' | ')} |`,
      `| --- | ${ENVIRONMENTS.map(() => '---').join(' | ')} |`,
      ...ENDPOINT_GROUPS.map(
        (group) => `| ${group.name} | ${ENVIRONMENTS.map((env) => cell(this.summarize(env, group))).join(' | ')} |`,
      ),
      '',
      ...testLines,
      '',
      '### Needs attention',
      '',
      ...this.attentionLines(),
    ].join('\n');
  }

  private attentionLines(): string[] {
    const lines = [
      ...this.offline().map((env) => `- **${env.name}** is offline.`),
      ...this.problems().map(({ env, endpoint, result }) => {
        const status = result.status ? String(result.status) : 'No response';
        const message = result.message ? `: ${oneLine(result.message)}` : '';
        return `- **${env.name}** \`${endpoint.method} ${endpoint.path}\` ${status}${message}`;
      }),
    ];
    return lines.length > 0 ? lines : ['Nothing needs attention.'];
  }
}

/**
 * e.g. "3 of 4 passed · 1 skipped". Endpoints the full test hasn't reached yet aren't counted:
 * the pill and the full test line already say so.
 */
export function countsText(summary: GroupSummary): string {
  if (summary.state === 'blocked' || summary.state === 'unreachable' || summary.state === 'checking') return '';
  const parts: string[] = [];
  if (summary.ran > 0) parts.push(`${summary.passed} of ${summary.ran} passed`);
  if (summary.skipped > 0) parts.push(`${summary.skipped} skipped`);
  return parts.join(' · ');
}

function groupState(states: CheckState[], overall: Overall): CheckState {
  if (overall === 'offline') return 'unreachable';
  if (states.every((state) => state === 'blocked')) return 'blocked';
  if (states.includes('checking')) return 'checking';
  if (states.includes('failing') || states.includes('unreachable')) return 'failing';
  if (states.includes('up')) return 'up';
  if (states.includes('idle')) return 'idle';
  return 'skipped';
}

function oneLine(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > 160 ? `${flat.slice(0, 159)}…` : flat;
}
