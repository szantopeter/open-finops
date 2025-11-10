import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RiImportService } from '../../services/ri-import.service';
import { RiDataService } from '../../services/ri-data.service';
import { StorageService } from '../../../core/services/storage.service';
import { PageStateService } from '../../../core/services/page-state.service';

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
  `,
})
export class RiImportUploadComponent {
  lastError?: string;

  constructor(
    private readonly parser: RiImportService,
    private readonly data: RiDataService,
    private readonly storage: StorageService,
    private readonly pageState: PageStateService,
  ) {}

  async onFile(event: Event) {
    this.lastError = undefined;
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const res = await this.parser.parseFile(file);
    if (res.errors) {
      this.lastError = res.errors.join('; ');
      this.data.clear();
      return;
    }
    if (res.import) {
      this.data.setImport(res.import);
      // persist via generic storage and notify the framework coordinator
      await this.storage.set('ri-import', res.import as any);
      await this.pageState.saveKey('ri-import');
    }
  }
}
