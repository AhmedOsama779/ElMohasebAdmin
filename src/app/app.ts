import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Validity } from './core/services/validity';
import { Suspended } from './shared/components/suspended/suspended';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Suspended],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('ElMohasebAdmin');
  protected validity = inject(Validity);
}