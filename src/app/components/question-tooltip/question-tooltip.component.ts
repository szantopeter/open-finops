import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-question-tooltip',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="relative inline-block">
      <span
        class="w-5 h-5 inline-flex items-center justify-center rounded-full bg-gray-200 text-gray-700 text-xs font-bold cursor-default"
        tabindex="0"
        aria-describedby="tooltip"
      >
        ?
      </span>

      <span
        role="tooltip"
        class="absolute z-10 bg-gray-800 text-white text-xs rounded px-2 py-1 left-1/2 transform -translate-x-1/2 -translate-y-full whitespace-nowrap pointer-events-none transition-opacity duration-150"
      >
        {{ text }}
      </span>
    </span>
  `,
  styles: [
    `
      :host .relative span[role="tooltip"] {
        visibility: hidden;
        opacity: 0;
        transform: translateX(-50%) translateY(-0.75rem);
      }

      :host .relative:hover span[role="tooltip"],
      :host .relative:focus-within span[role="tooltip"] {
        visibility: visible;
        opacity: 1;
        transform: translateX(-50%) translateY(-1rem);
      }
    `
  ]
})
export class QuestionTooltipComponent {
  @Input()
  text = '';
}
