import {Component, Input} from '@angular/core';
import {NgClass} from '@angular/common';

@Component({
  selector: 'app-step-indicator',
  imports: [
    NgClass
  ],
  templateUrl: './step-indicator.html',
  styleUrl: './step-indicator.scss'
})
export class StepIndicator {
  @Input() currentStep = 1;
  @Input() totalSteps = 3;
  @Input() stepTitles: string[] = [];
  protected readonly Math = Math;
}
