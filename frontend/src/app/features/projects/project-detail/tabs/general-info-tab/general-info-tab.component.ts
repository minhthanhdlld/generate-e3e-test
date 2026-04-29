import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Project } from '../../../../../core/models/project.model';
import { StatusPillComponent } from '../../../../../layout/shared/status-pill/status-pill.component';

@Component({
  selector: 'app-general-info-tab',
  standalone: true,
  imports: [CommonModule, RouterLink, StatusPillComponent],
  templateUrl: './general-info-tab.component.html',
  styleUrls: ['./general-info-tab.component.css'],
})
export class GeneralInfoTabComponent {
  @Input({ required: true }) project!: Project;
}
