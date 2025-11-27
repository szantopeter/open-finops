import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';

import { RiCSVParserService, RiImportService } from './service/ri-portfolio-import.service';
import tippy from 'tippy.js';
import type { Instance } from 'tippy.js';
import 'tippy.js/dist/tippy.css';

@Component({
  selector: 'app-ri-import-upload',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div>
      <div class="flex items-center gap-2">
        <input #fileInput type="file" accept=".csv" hidden (change)="onFile($event)" />
        <button #uploadBtn class="file-input" type="button" (click)="triggerFile()" aria-label="Upload new RI data">Upload new RI data</button>
        <button #helpIcon class="help-icon ml-2" type="button" aria-label="RI CSV export instructions">?</button>
      </div>
      <ul *ngIf="lastError" class="text-red-600 mt-2 list-disc list-inside">
        <li *ngFor="let error of lastError">{{ error }}</li>
      </ul>
    </div>
  `,
  styleUrls: ['./ri-portfolio-upload.component.scss']
})

export class RiImportUploadComponent implements AfterViewInit, OnDestroy {
  lastError?: string[];
  RI_IMPORT_KEY = 'ri-import';
  helpText = 'To generate a new RI file go to cloudability select Optimise / Commitment Portfolio then choose RDS Reserved Instances from the Commitment Type dropdown. Then click the "Export Reservations CSV" button above the table';

  @ViewChild('fileInput', { read: ElementRef }) fileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('helpIcon', { read: ElementRef }) helpIcon?: ElementRef;
  private readonly _removeListener?: () => void;
  private _tippy?: Instance | null;
  private _removeHelpListeners?: () => void;
  // no-op; tippy cleanup handled via instance.destroy()

  constructor(
    private readonly riCSVParserService: RiCSVParserService,
    private readonly riImportService: RiImportService
  ) {}

  ngAfterViewInit(): void {
    try {
      // nothing to wire for the upload button; the native input change is bound in template
      const helpEl = this.helpIcon?.nativeElement;
      if (helpEl instanceof HTMLElement) {
        try {
          this._tippy = tippy(helpEl, {
            content: this.helpText,
            allowHTML: false,
            placement: 'bottom',
            maxWidth: 320,
            appendTo: document.body,
            theme: 'wk-help',
            animation: 'shift-away',
            onShow(instance) {
              const box = instance.popper.querySelector('.tippy-box');
              if (box) {
                box.classList.remove('animate__animated', 'animate__rubberBand');
                // force reflow
                const _ = (box as HTMLElement).offsetWidth;
                box.classList.add('animate__animated', 'animate__rubberBand');
              }
            },
            onHidden(instance) {
              const box = instance.popper.querySelector('.tippy-box');
              if (box) box.classList.remove('animate__animated', 'animate__rubberBand');
            }
          });
          // ensure tooltip appears even if tippy listeners don't fire in some environments
          const enter = () => this._tippy?.show();
          const leave = () => this._tippy?.hide();
          helpEl.addEventListener('mouseenter', enter);
          helpEl.addEventListener('mouseleave', leave);
          helpEl.addEventListener('focus', enter);
          helpEl.addEventListener('blur', leave);
          this._removeHelpListeners = () => {
            helpEl.removeEventListener('mouseenter', enter);
            helpEl.removeEventListener('mouseleave', leave);
            helpEl.removeEventListener('focus', enter);
            helpEl.removeEventListener('blur', leave);
          };
        } catch (err) {
          console.warn('ri-import: tippy init failed', err);
        }
      }
    } catch (e) {
      console.warn('ri-import: could not initialize upload control', e);
    }
  }

  ngOnDestroy(): void {
    if (this._removeListener) this._removeListener();
    if (this._tippy) {
      try {
        this._tippy.destroy();
      } catch {
        // ignore
      }
      this._tippy = null;
    }
    if (this._removeHelpListeners) this._removeHelpListeners();
  }

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
