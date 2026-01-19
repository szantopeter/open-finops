import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild } from '@angular/core';

import { RiCSVParserService, RiImportService } from './service/ri-portfolio-import.service';
import { QuestionTooltipComponent } from '../question-tooltip/question-tooltip.component';

@Component({
  selector: 'app-ri-import-upload',
  standalone: true,
  imports: [CommonModule, QuestionTooltipComponent],
  template: `
    <div>
      <div class="flex items-center gap-2">
        <input #fileInput type="file" accept=".csv" hidden (change)="onFile($event)" />
        <button #uploadBtn class="file-input" type="button" (click)="triggerFile()" aria-label="Upload new RI data">Upload new RI data</button>
        <app-question-tooltip [text]="helpHtml.innerHTML" class="ml-2"></app-question-tooltip>
      </div>
      <div #helpHtml style="display:none">
        <p>To generate a new RI file go to your cost management platform, select <strong>Optimise / Commitment Portfolio</strong> then choose <strong>RDS Reserved Instances</strong> from the Commitment Type dropdown. Click the <strong>Export Reservations CSV</strong> button above the table.</p>
      </div>
      <ul *ngIf="lastError" class="text-red-600 mt-2 list-disc list-inside">
        <li *ngFor="let error of lastError">{{ error }}</li>
      </ul>
    </div>
  `,
  styleUrls: ['./ri-portfolio-upload.component.scss']
})

export class RiImportUploadComponent {
  lastError?: string[];
  RI_IMPORT_KEY = 'ri-import';
  // help HTML moved to template; tooltip receives the HTML via hidden div.

  @ViewChild('fileInput', { read: ElementRef }) fileInput?: ElementRef<HTMLInputElement>;

  constructor(
    private readonly riCSVParserService: RiCSVParserService,
    private readonly riImportService: RiImportService
  ) {}


  triggerFile(): void {
    const input = this.fileInput?.nativeElement;
    if (input) input.click();
  }

  async onFile(event: Event): Promise<void> {
    this.lastError = undefined;
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    const riImportParseResult = await this.riCSVParserService.parseFile(file);
    const error = await this.riImportService.saveImportResult(riImportParseResult);
    this.lastError = error ?? undefined;
  }
}
