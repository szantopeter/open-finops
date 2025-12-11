import { Component, Input, OnChanges, SimpleChanges, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RiPortfolio } from '../../components/ri-portfolio-upload/models/ri-portfolio.model';
import { RiCategorizatorCalculator } from '../../calculators/ri-categorizator/ri-categorizator-calculator';
import { NgxEchartsModule } from 'ngx-echarts';

@Component({
  selector: 'app-ri-categorization-chart',
  templateUrl: './ri-categorization-chart.component.html',
  styleUrls: ['./ri-categorization-chart.component.scss'],
  standalone: true,
  imports: [NgxEchartsModule, CommonModule]
})
export class RiCategorizationChartComponent implements OnChanges, AfterViewInit {
  @Input() riPortfolio!: RiPortfolio;

  chartOptions: any = null;
  private viewInitialized = false;

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.viewInitialized = true;
      if (this.riPortfolio) {
        this.updateChart();
      }
    }, 100);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['riPortfolio'] && this.riPortfolio && this.viewInitialized) {
      setTimeout(() => this.updateChart(), 0);
    }
  }

  private updateChart(): void {
    const categoryCounts = RiCategorizatorCalculator.categorizeRiPortfolio(this.riPortfolio);
    
    if (categoryCounts.size === 0) {
      this.chartOptions = {
        title: {
          text: 'No RI Data Available',
          left: 'center',
          top: 'center'
        },
        series: []
      };
      return;
    }

    const data = Array.from(categoryCounts.entries()).map(([key, value]) => ({
      name: this.formatCategoryName(key),
      value
    }));

    // Sort descending by count so the largest slices appear first
    data.sort((a, b) => (b.value as number) - (a.value as number));

    // Sort categories by value descending so largest slices appear first
    data.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    this.chartOptions = {
      title: {
        text: 'RI Type Distribution',
        left: 'center',
        textStyle: {
          fontSize: 18,
          fontWeight: 'bold'
        }
      },
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} reservations ({d}%)',
        textStyle: {
          fontSize: 14
        }
      },
      legend: {
        show: false,
        orient: 'horizontal',
        bottom: 10,
        left: 'center',
        textStyle: {
          fontSize: 12
        },
        type: 'scroll'
      },
      series: [
        {
          name: 'RI Types',
          type: 'pie',
          radius: ['45%', '75%'],
          center: ['50%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: {
            borderRadius: 10,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: {
            show: true,
            fontSize: 15,
            fontWeight: 'bold',
            formatter: '{b}\n{c} ({d}%)'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 18,
              fontWeight: 'bold'
            },
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          },
          data: data
        }
      ]
    };
  }

  private formatCategoryName(key: string): string {
    const parts = key.split('/');
    const filePart = parts[parts.length - 1];
    return filePart.replaceAll('_', ' ');
}
}