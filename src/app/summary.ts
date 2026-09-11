import { Component, inject, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ENDPOINT_GROUPS, EndpointGroup } from './endpoints';
import { ENVIRONMENTS, Environment } from './environments';
import { GROUP_LABELS, Problem, StatusBoard, countsText } from './status-board';

const COPY_LABEL = 'Copy as Markdown';

/** Both environments at a glance: one pill per group, then only what's broken. */
@Component({
  selector: 'app-summary',
  imports: [DatePipe],
  templateUrl: './summary.html',
  styleUrl: './summary.css',
})
export class Summary {
  protected readonly board = inject(StatusBoard);
  protected readonly environments = ENVIRONMENTS;
  protected readonly groups = ENDPOINT_GROUPS;
  protected readonly labels = GROUP_LABELS;
  protected readonly countsText = countsText;
  protected readonly copyLabel = signal(COPY_LABEL);

  /** Asks the page to show one group on one environment in Details. */
  readonly open = output<{ env: Environment; group: EndpointGroup }>();

  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.board.toMarkdown());
      this.copyLabel.set('Copied');
    } catch {
      this.copyLabel.set("Couldn't copy");
    }
    setTimeout(() => this.copyLabel.set(COPY_LABEL), 2000);
  }

  protected problemMeta({ env, result }: Problem): string {
    return result.status ? `${env.name} · ${result.status} · ${result.ms} ms` : `${env.name} · No response`;
  }
}
