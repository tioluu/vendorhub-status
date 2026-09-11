import { Component, DestroyRef, Injector, afterNextRender, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { CheckResult, CheckState } from './check';
import { ENDPOINT_GROUPS, EndpointGroup } from './endpoints';
import { ENVIRONMENTS, Environment } from './environments';
import { Overall } from './health-checks';
import { StatusBoard } from './status-board';
import { Summary } from './summary';

type View = 'summary' | 'details';

const REFRESH_MS = 30_000;
const VIEW_KEY = 'vendorhub-status:view';

const OVERALL_LABELS: Record<Overall, string> = {
  checking: 'Checking the API…',
  operational: 'All checks passing',
  degraded: 'Some checks failing',
  offline: 'API is offline',
};

const STATE_LABELS: Record<CheckState, string> = {
  idle: 'Not run',
  checking: 'Checking',
  up: 'OK',
  failing: 'Failed',
  unreachable: 'Unreachable',
  skipped: 'Skipped',
  blocked: 'Not allowed',
};

@Component({
  selector: 'app-root',
  imports: [DatePipe, Summary],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly board = inject(StatusBoard);
  private readonly injector = inject(Injector);

  protected readonly environments = ENVIRONMENTS;
  protected readonly groups = ENDPOINT_GROUPS;
  protected readonly overallLabels = OVERALL_LABELS;
  protected readonly stateLabels = STATE_LABELS;
  protected readonly groupAnchor = groupAnchor;
  protected readonly selected = signal<Environment>(ENVIRONMENTS[0]);
  protected readonly view = signal<View>(savedView());

  constructor() {
    this.board.checkAll();
    const timer = setInterval(() => this.board.checkAll(), REFRESH_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  protected setView(view: View): void {
    this.view.set(view);
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      // Storage can be blocked; the page then just opens on Summary next time.
    }
  }

  /** Shows one group on one environment in Details. The summary grid calls this. */
  protected openGroup(env: Environment, group: EndpointGroup): void {
    this.selected.set(env);
    this.setView('details');
    afterNextRender(
      () => document.getElementById(groupAnchor(group))?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      { injector: this.injector },
    );
  }

  protected detail(env: Environment, result: CheckResult): string {
    switch (result.state) {
      case 'up':
      case 'failing':
        return `${result.status} · ${result.ms} ms`;
      case 'unreachable':
        return 'No response';
      case 'idle':
        return 'Run the full test';
      case 'blocked':
        return `${env.name} is read-only`;
      default:
        return '';
    }
  }
}

function groupAnchor(group: EndpointGroup): string {
  return `group-${group.name.toLowerCase()}`;
}

function savedView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'details' ? 'details' : 'summary';
  } catch {
    return 'summary';
  }
}
