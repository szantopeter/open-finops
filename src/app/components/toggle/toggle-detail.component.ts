import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-toggle-detail',
  standalone: true,
  template: `
    <span style="display:inline-flex; align-items:center; gap:8px;">
      <span style="font-size:14px; color:var(--muted, #666);">{{ leftLabel }}</span>
      <div
        role="switch"
        tabindex="0"
        [attr.aria-checked]="checked"
        (click)="toggle()"
        (keydown.enter)="$event.preventDefault(); toggle()"
        (keydown.space)="$event.preventDefault(); toggle()"
        [style.width.px]="44"
        [style.height.px]="24"
        [style.background]="checked ? '#4CAF50' : '#ddd'"
        style="border-radius:12px; display:inline-flex; align-items:center; padding:3px; cursor:pointer; transition:background .18s ease;"
      >
        <div [style.transform]="checked ? 'translateX(20px)' : 'translateX(0)'
          " style="width:18px; height:18px; border-radius:50%; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.25); transition:transform .18s ease;"></div>
      </div>
      <span style="font-size:14px; color:var(--muted, #666);">{{ rightLabel }}</span>
    </span>
  `
})
export class ToggleDetailComponent {
  @Input() checked = false;
  @Output() checkedChange = new EventEmitter<boolean>();
  @Input() leftLabel = 'Left';
  @Input() rightLabel = 'Right';

  toggle(): void {
    this.checked = !this.checked;
    this.checkedChange.emit(this.checked);
  }
}
