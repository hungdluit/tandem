import { IActor } from "tandem-common/actors";
import { inject } from "tandem-common/decorators";
import { WrapBus } from "mesh";
import { BubbleBus } from "tandem-common/busses";
import { diffArray } from "tandem-common/utils/array";
import { watchProperty } from "tandem-common/observable";
import { Action, TreeNodeAction } from "tandem-common/actions";
import { IDisposable, ITyped, IValued, IPatchable } from "tandem-common/object";
import { bindable, mixin, virtual, patchable } from "tandem-common/decorators";
import { IInjectable, Injector, DEPENDENCIES_NS, Dependencies } from "tandem-common/dependencies";
import { EntityFactoryDependency, EntityDocumentDependency, ENTITY_DOCUMENT_NS } from "tandem-common/dependencies";

import { TreeNode } from "tandem-common/tree";
import { IExpression } from "tandem-common/ast";

import {
  IEntityDocument,
  EntityMetadata,
  IValueEntity,
  IEntity
} from "./base";

export * from "./base";
export * from "./display";
export * from "./utils";

export abstract class BaseEntity<T extends IExpression> extends TreeNode<BaseEntity<any>> implements IEntity, IPatchable {

  public metadata: EntityMetadata;

  @patchable
  protected _source: T;

  public context: any;
  private _loaded: boolean;
  private _allChildEntities: Array<IEntity>;
  private _mappedSourceChildren: Array<IExpression>;

  constructor(_source: T) {
    super();
    this._source = _source;
    this.initialize();
  }

  get document(): IEntityDocument {
    return <IEntityDocument><any>this._source.source;
  }

  get source(): T {
    return this._source;
  }

  public dispose() {
    for (const child of this.children) {
      child.dispose();
    }
  }

  protected get dependencies(): Dependencies {
    return this.context.dependencies;
  }

  protected getChildContext() {
    return this.context;
  }

  public patch(entity: BaseEntity<any>) {
    this.onEvaluated();
  }

  public flatten(): Array<IEntity> {
    if (this._allChildEntities) return this._allChildEntities;
    const items: Array<IEntity> = [this];
    for (const child of this.children) {
      items.push(...child.flatten());
    }
    return this._allChildEntities = items;
  }

  public compare(entity: IEntity): number {
    return Number(entity.constructor === this.constructor);
  }

  public async evaluate(context: any) {
    this.context = context;
    if (this._loaded) {
      await this.update();
    } else {
      this._loaded = true;
      await this.load();
    }

    this.onEvaluated();

    // mapContext may need evaluated children, so execute
    // it at the end
    return await this.mapContext(this.context);
  }

  protected mapContext(context: any) {
    return context;
  }

  protected onChildAdded(child: BaseEntity<any>) {
    super.onChildAdded(child);
    this._allChildEntities = undefined;
  }

  protected onChildRemoved(child: BaseEntity<any>) {
    super.onChildRemoved(child);
    this._allChildEntities = undefined;
  }

  protected async load() {
    await this.evaluateChildren();
  }

  protected async update() {
    await this.evaluateChildren();
  }

  protected async evaluateChildren() {

    const previousMappedSourceChildren = this._mappedSourceChildren || [];

    // copy source children in case the returned value is a reference that could
    // be mutated outside of this implemenetation.
    const mappedSourceChildren = this.mapSourceChildren().concat();
    this._mappedSourceChildren =  mappedSourceChildren;
    for (let i = 0, n = mappedSourceChildren.length; i < n; i++) {
      const childSource = mappedSourceChildren[i];
      let childEntity   = this.children[i];
      const childEntityFactory = EntityFactoryDependency.findBySource(childSource, this.context.dependencies);
      if (!childEntity || childEntity.source !== childSource || childEntity.constructor !== childEntityFactory.entityClass || childEntity.shouldDispose()) {

        if (childEntity) {
          this.removeChild(childEntity);
          childEntity.dispose();
        }

        childEntity = childEntityFactory.create(childSource);
        this.context = await childEntity.evaluate(this.getChildContext());
        this.insertChildAt(childEntity, i);
      } else {
        this.context = await childEntity.evaluate(this.getChildContext());
      }
    }

    for (let i = mappedSourceChildren.length, n  = this.children.length; i < n; i++) {
      if (previousMappedSourceChildren.indexOf(this.children[i].source) !== -1) {
        this.removeChild(this.children[i--]);
        n--;
      }
    }
  }

  protected shouldDispose() {
    return false;
  }

  public async loadExpressionAndInsertChildAt(childExpression: IExpression, index: number) {
    const factory = EntityFactoryDependency.findBySource(childExpression, this.context.dependencies);
    if (!factory) {
      throw new Error(`Unable to find entity factory expression ${childExpression.constructor.name}`);
    }
    const entity = factory.create(childExpression);
    this.context = await entity.evaluate(this.getChildContext());
    this.insertChildAt(entity, index);
    return entity;
  }

  public loadExpressionAndAppendChild(childExpression: IExpression) {
    return this.loadExpressionAndInsertChildAt(childExpression, this.children.length);
  }

  public clone() {
    let clone = super.clone();
    clone.metadata.copyFrom(this.metadata);
    if (this._loaded) {
      clone.onEvaluated();
    }
    return clone;
  }

  // TODO - onEvaluated
  protected onEvaluated() { }

  protected initialize() {
    this.metadata = new EntityMetadata(this, this.getInitialMetadata());
    this.metadata.observe(new BubbleBus(this));
  }

  protected getInitialMetadata() {

    // TODO - possibly search for metadata from dependencies
    return {};
  }

  protected mapSourceChildren(): Array<IExpression> {
    return <Array<IExpression>>this.source.children;
  }

  protected abstract cloneLeaf();
}

export abstract class BaseValueEntity<T extends IExpression & IValued> extends BaseEntity<T> implements IValueEntity {

  @bindable()
  public value: any;

  private _shouldUpdate: boolean;

  constructor(source: T) {
    super(source);
    watchProperty(this.source, "value", this.onSourceValueChange.bind(this)).trigger();
  }

  mapSourceChildren() {
    return [];
  }

  protected onSourceValueChange(newValue: any, oldValue: any) {
    this.value = newValue;
  }
}
