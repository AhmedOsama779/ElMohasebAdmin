import { Component, inject } from '@angular/core';
import { Validity } from '../../../core/services/validity';

@Component({
  selector: 'app-suspended',
  templateUrl: './suspended.html',
  styleUrl: './suspended.scss',
})
export class Suspended {
  validity = inject(Validity);
  year = new Date().getFullYear();

  // If the logo file is missing, hide the broken image icon
  hideLogo(event: Event) {
    (event.target as HTMLElement).style.display = 'none';
  }
}