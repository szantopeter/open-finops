import { Component, Input, OnChanges, SimpleChanges, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RiPortfolio } from '../../components/ri-portfolio-upload/models/ri-portfolio.model';
import { RiCategorizatorCalculator } from '../../calculators/ri-categorizator/ri-categorizator-calculator';
import { NgxEchartsModule } from 'ngx-echarts';
import { MigrationRecommendationsComponent } from '../migration-recommendations/migration-recommendations.component';
import { ToggleDetailComponent } from '../toggle/toggle-detail.component';
import { AgGridModule } from 'ag-grid-angular';
import { ColDef } from 'ag-grid-community';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';

// Register all community modules once at module load time to avoid runtime error #272
ModuleRegistry.registerModules([AllCommunityModule]);

@Component({
  selector: 'app-ri-categorization-chart',
  templateUrl: './ri-categorization-chart.component.html',
  styleUrls: ['./ri-categorization-chart.component.scss'],
  standalone: true,
  imports: [NgxEchartsModule, CommonModule, MigrationRecommendationsComponent, ToggleDetailComponent, AgGridModule]
})
 

export class RiCategorizationChartComponent implements OnChanges, AfterViewInit {
  @Input() riPortfolio!: RiPortfolio;

  chartOptions: any = null;
  public viewMode: 'donut' | 'table' = 'donut';
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
    
    // Always update the category counts for the child component
    this.lastCategoryCounts = categoryCounts;
    // Update ag-grid row data
    this.updateTableDataFromMap(categoryCounts);
    
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
      name: this.formatCategoryName(key.toString()),
      value
    }));

    // Sort categories by value descending so largest slices appear first
    data.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    this.chartOptions = {
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

  public toggleView(mode: 'donut' | 'table'): void {
    this.viewMode = mode;
  }

  public get isTableView(): boolean {
    return this.viewMode === 'table';
  }

  public set isTableView(value: boolean) {
    this.viewMode = value ? 'table' : 'donut';
  }

  // expose the categoryCounts as a property so the child can use it
  public lastCategoryCounts: Map<any, number> = new Map();

  public formatCategoryName(key: any): string {
    if (key == null) return '';

    let keyStr: string;
    if (typeof key === 'string') {
      keyStr = key;
    } else if (typeof key.toString === 'function') {
      keyStr = key.toString();
    } else {
      keyStr = String(key);
    }

    const parts = keyStr.split('/');
    const filePart = parts[parts.length - 1] ?? '';
    return filePart.replaceAll('_', ' ');
  }

  // Helper for the keyvalue pipe to sort entries by value desc
  public sortByValueDesc = (a: { key: any; value: any }, b: { key: any; value: any }) => {
    return (b.value ?? 0) - (a.value ?? 0);
  }

  public extractRegion(key: any): string {
    if (!key) return '';
    if (typeof key === 'string') {
      return key.split('/')[0] ?? '';
    }
    return key.region ?? (key.toString ? key.toString().split('/')[0] : '');
  }

  public extractInstanceClass(key: any): string {
    if (!key) return '';
    if (typeof key === 'string') {
      return key.split('/')[1] ?? '';
    }
    return key.instanceClass ?? (key.toString ? key.toString().split('/')[1] : '');
  }

  public extractEngine(key: any): string {
    if (!key) return '';
    if (typeof key === 'string') {
      // engine is after the last hyphen in the third segment
      const parts = key.split('/');
      const last = parts[parts.length - 1] ?? '';
      const hyphenParts = last.split('-');
      return hyphenParts[hyphenParts.length - 1] ?? '';
    }
    return key.engineKey ?? key.engine ?? (key.toString ? (() => {
      const s = key.toString();
      const parts = s.split('/');
      const last = parts[parts.length - 1] ?? '';
      return last.split('-').pop() ?? '';
    })() : '');
  }

  // ag-grid column definitions and row data

  public columnDefs: ColDef<any>[] = [
    { field: 'region', headerName: 'Region', sortable: true, filter: 'agTextColumnFilter', resizable: true },
    { field: 'instanceClass', headerName: 'Instance Class', sortable: true, filter: 'agTextColumnFilter', resizable: true },
    { field: 'engine', headerName: 'Engine', sortable: true, filter: 'agTextColumnFilter', resizable: true },
    { field: 'count', headerName: 'Count', sortable: true, filter: 'agNumberColumnFilter', resizable: true }
  ];

  public defaultColDef = { sortable: true, filter: true, resizable: true };

  public rowData: Array<{ region: string; instanceClass: string; engine: string; count: number }> = [];

  private updateTableDataFromMap(map: Map<any, number>): void {
    this.rowData = Array.from(map.entries()).map(([key, value]) => ({
      region: this.extractRegion(key),
      instanceClass: this.extractInstanceClass(key),
      engine: this.extractEngine(key),
      count: value ?? 0
    }));
    // sort by count desc
    this.rowData.sort((a, b) => b.count - a.count);
  }
}