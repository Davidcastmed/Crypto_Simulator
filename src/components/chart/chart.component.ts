import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-chart',
  template: `
<div class="w-full h-full">
  <svg [attr.viewBox]="viewBox" preserveAspectRatio="none" class="w-full h-full">
    <defs>
      <linearGradient [id]="isPositiveChange() ? 'positiveGradient' : 'negativeGradient'" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" [attr.stop-color]="chartColor()" stop-opacity="0.4"/>
        <stop offset="100%" [attr.stop-color]="chartColor()" stop-opacity="0"/>
      </linearGradient>
    </defs>

    <path 
      [attr.d]="areaPathData()"
      [attr.fill]="isPositiveChange() ? 'url(#positiveGradient)' : 'url(#negativeGradient)'"
      stroke="none"
    />

    <path 
      [attr.d]="pathData()" 
      fill="none" 
      [attr.stroke]="chartColor()"
      stroke-width="2" 
      stroke-linecap="round" 
      stroke-linejoin="round"
    />
  </svg>
</div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
})
export class ChartComponent {
  data = input.required<number[]>();
  isPositiveChange = input(true);

  viewBox = '0 0 300 100';
  
  chartColor = computed(() => this.isPositiveChange() ? '#4ade80' : '#f87171'); // green-400 or red-400

  pathData = computed(() => {
    const dataPoints = this.data();
    if (dataPoints.length < 2) return '';

    const max = Math.max(...dataPoints);
    const min = Math.min(...dataPoints);
    const range = max - min === 0 ? 1 : max - min;

    const points = dataPoints.map((d, i) => {
      const x = (i / (dataPoints.length - 1)) * 300;
      const y = 100 - ((d - min) / range) * 90 - 5; // 5 padding top/bottom
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
  });

  areaPathData = computed(() => {
    const path = this.pathData();
    if (!path) return '';
    return `${path} L 300,100 L 0,100 Z`;
  });
}