import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

import { RiDataService } from './service/ri-portfolio-data.service';
import { RiCSVParserService, RiImportService } from './service/ri-portfolio-import.service';
import { StorageService } from '../../storage-service/storage.service';

@Component({
  selector: 'app-ri-import-upload',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="p-4 border rounded">
      <h3>Import RIs</h3>
      <input type="file" (change)="onFile($event)" accept=".csv,text/csv" />
      <div *ngIf="lastError" class="text-red-600 mt-2">{{ lastError }}</div>
    </div>
  `
})

export class RiImportUploadComponent {
  lastError?: string;
  RI_IMPORT_KEY = 'ri-import';

  constructor(
    private readonly riCSVParserService: RiCSVParserService,
    private readonly riDataService: RiDataService,
    private readonly storageService: StorageService,
    private readonly riImportService: RiImportService
  ) {}

  async onFile(event: Event): Promise<void> {
    this.lastError = undefined;
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    const riImportParseResult = await this.riCSVParserService.parseFile(file);
    const error = await this.riImportService.saveImportResult(riImportParseResult);
    this.lastError = error;
  }
}
