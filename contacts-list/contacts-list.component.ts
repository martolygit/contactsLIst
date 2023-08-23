import {Component, Inject, Injector, OnInit} from '@angular/core';
import {DataService} from "../../../services/data.service";
import {ActivatedRoute} from "@angular/router";
import {AccountObject} from "../../../models/account-model";
import {LeadObject} from "../../../models/lead-model";
import {AddLeadComponent} from "../../../popup/add-lead/add-lead.component";
import {LeadInfoComponent} from "../../../popup/lead-info/lead-info.component";
import {TuiDialogService} from "@taiga-ui/core";
import {PolymorpheusComponent} from "@tinkoff/ng-polymorpheus";
import {
    BehaviorSubject,
    combineLatest,
    debounceTime, distinctUntilChanged,
    filter,
    map,
    Observable,
    share,
    startWith, Subject,
    switchMap
} from "rxjs";
import {tuiControlValue, tuiIsFalsy, tuiIsPresent} from "@taiga-ui/cdk";
import {TuiTablePagination} from "@taiga-ui/addon-table";
import {FormControl, FormGroup, Validators} from "@angular/forms";
import {takeUntilDestroyed} from "@angular/core/rxjs-interop";
import {CONTACTS_FILTER_BY_CHANNEL_TYPE} from "../../../models/select-data-types/core-types";
import {ChannelData, ChannelsArray, ChannelType} from "../../../models/select-data-types/channel-types";

@Component({
    selector: 'app-contacts-list',
    templateUrl: './contacts-list.component.html',
    styleUrls: ['./contacts-list.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContactsListComponent implements OnInit {

    public currentAccount: AccountObject | undefined;

    protected readonly ChannelsArray = ChannelsArray;

    readonly contactColumns = ['name', 'channel', 'date'];

    readonly direction$ = new BehaviorSubject<-1 | 1>(-1);
    readonly sorter$ = new BehaviorSubject<'name' | 'date'>('name');
    readonly size$ = new BehaviorSubject(10);
    readonly page$ = new BehaviorSubject(0);
    search$ = new BehaviorSubject<string>('');
    readonly searchForm = new FormGroup({
        searchValue: new FormControl('', []),
        channelValue: new FormControl<ChannelType | ''>('', []),
    });

    readonly request$ = combineLatest([
        this.sorter$,
        this.direction$,
        this.page$.pipe(distinctUntilChanged()),
        this.size$.pipe(distinctUntilChanged()),
        this.search$,
        tuiControlValue<string>(this.searchForm.get("channelValue")!)
    ]).pipe(
        debounceTime(0),
        switchMap(query => this.data.getLeadsByParams(this.currentAccount!, ...query).pipe(startWith(null))),
        share()
    );

    readonly requestTotal$ = combineLatest([
        this.search$,
        tuiControlValue<string>(this.searchForm.get("channelValue")!)
    ]).pipe(
        debounceTime(0),
        switchMap(query => this.data.getLeadsTotal(this.currentAccount!, ...query)),
        share()
    );

    readonly loading$ = this.request$.pipe(map(tuiIsFalsy));
    data$?: Observable<readonly LeadObject[]>;
    total$?: Observable<number>;

    public ChannelData = ChannelData;

    constructor(public data: DataService,
                private route: ActivatedRoute,
                @Inject(TuiDialogService) private readonly dialogService: TuiDialogService,
                @Inject(Injector) private readonly injector: Injector
    ) {

        route.paramMap.subscribe(value => {
            if (value.has('id')) {
                const accountId = value.get('id');
                if (accountId) {
                    this.currentAccount = this.data.getAccountByID(+accountId);

                    if (this.currentAccount) {
                        this.data$ = this.request$.pipe(
                            filter(tuiIsPresent),
                            map(leads => leads),
                            startWith([]),
                        );
                        this.total$ = this.requestTotal$;
                    }
                }
            }
        });

        this.searchForm.get("searchValue")?.valueChanges.pipe(takeUntilDestroyed(), debounceTime(1000)).subscribe(fieldValue => {
            this.doRequest();
        });
    }

    ngOnInit(): void {
    }

    doRequest(): void {

        if (this.searchForm.get("searchValue")!.value !== null){
            this.search$.next(this.searchForm.get("searchValue")!.value!);

        }
    }

    onPaginationChange(e: TuiTablePagination): void {

        this.size$.next(e.size);
        this.page$.next(e.page);
    }

    onCreateContactClick() {

        this.dialogService.open<void>(
            new PolymorpheusComponent(AddLeadComponent, this.injector),
            {
                data: this.currentAccount,
                label: 'Add Contact'
            }
        ).subscribe(() => {
            this.doRequest();
        });

    }

    onLeadClick(lead: LeadObject) {

        this.dialogService.open<{deleteContact: boolean}>(
            new PolymorpheusComponent(LeadInfoComponent, this.injector),
            {
                data: lead,
                size: "l",
                label: lead.getName()
            }
        ).subscribe((value: any) => {
            if (value.deleteContact) {
                this.doRequest();
            }
        });
    }

    getFilterLabel(): string {
        if (ChannelsArray.some(value => value === this.searchForm.get('channelValue')!.value)) {
            return ChannelData.get(this.searchForm.get('channelValue')!.value as any)!.name
        }
        return 'All';
    }
}
