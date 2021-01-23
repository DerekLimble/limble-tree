import {
   AfterViewInit,
   ChangeDetectorRef,
   Component,
   Input,
   ViewChild,
   ViewContainerRef
} from "@angular/core";
import { ComponentCreatorService } from "../singletons/component-creator.service";
import { DropZoneService } from "../singletons/drop-zone.service";
import { LimbleTreeComponent } from "../limble-tree.component";
import {
   ComponentObj,
   INDENT,
   LimbleTreeNode,
   LimbleTreeService
} from "../singletons/limble-tree.service";
import { TempService } from "../singletons/temp.service";
import { TreeRendererService } from "../singletons/tree-renderer.service";
import { arraysAreEqual } from "../util";

@Component({
   selector: "limble-tree-node",
   templateUrl: "./limble-tree-node.component.html",
   styleUrls: ["./limble-tree-node.component.scss"]
})
export class LimbleTreeNodeComponent implements AfterViewInit {
   @Input() component: ComponentObj | undefined;
   @Input() nodeData: LimbleTreeNode["data"];
   @Input() coordinates: Array<number> | undefined;
   @Input() childNodes: Array<LimbleTreeNode> | undefined;
   @ViewChild("nodeHost", { read: ViewContainerRef }) private nodeHost:
      | ViewContainerRef
      | undefined;
   @ViewChild("dropZoneAbove", { read: ViewContainerRef })
   private dropZoneAbove: ViewContainerRef | undefined;
   @ViewChild("dropZoneBelow", { read: ViewContainerRef })
   private dropZoneBelow: ViewContainerRef | undefined;
   @ViewChild("children", { read: ViewContainerRef }) private children:
      | ViewContainerRef
      | undefined;

   constructor(
      private readonly componentCreatorService: ComponentCreatorService,
      private readonly changeDetectorRef: ChangeDetectorRef,
      private readonly tempService: TempService,
      private readonly dropZoneService: DropZoneService,
      private readonly limbleTreeService: LimbleTreeService,
      private readonly treeRendererService: TreeRendererService
   ) {}

   ngAfterViewInit() {
      this.registerDropZones();
      this.renderSelf();
      this.renderChildren();
      this.changeDetectorRef.detectChanges();
   }

   public dragstartHandler(event: DragEvent): void {
      event.stopPropagation();
      if (event.dataTransfer === null) {
         return;
      }
      event.dataTransfer.effectAllowed = "move";
      const draggedElement = event.target as HTMLElement;
      draggedElement.classList.add("dragging");
      this.tempService.set(this.coordinates);
   }

   public dragendHandler(event: DragEvent): void {
      event.stopPropagation();
      const draggedElement = event.target as HTMLElement;
      const sourceCoordinates = this.tempService.get() as Array<number>;
      this.tempService.delete();
      draggedElement.classList.remove("dragging");
      const dropZoneInfo = this.dropZoneService.getActiveDropZoneInfo();
      if (dropZoneInfo === null) {
         return;
      }
      this.dropZoneService.removeActiveAndSecondaryZones();
      if (dropZoneInfo.coordinates === undefined) {
         throw new Error("could not determine drop zone location");
      }
      this.limbleTreeService.move(sourceCoordinates, dropZoneInfo.coordinates);
   }

   public dragoverHandler(event: DragEvent) {
      if (
         this.tempService.get() === undefined ||
         this.coordinates === undefined
      ) {
         return;
      }
      const sourceCoordinates = this.tempService.get() as Array<number>;
      //If trying to drop on self, remove any remaining drop zones and return.
      if (
         arraysAreEqual(
            sourceCoordinates,
            this.coordinates.slice(0, sourceCoordinates.length)
         )
      ) {
         this.dropZoneService.removeActiveAndSecondaryZones();
         return;
      }
      const target = event.currentTarget as HTMLElement;
      const dividingLine = target.offsetHeight / 2;
      if (
         event.offsetY > dividingLine &&
         this.dropZoneBelow !== undefined &&
         this.dropZoneService.getActiveDropZoneInfo()?.container !==
            this.dropZoneBelow
      ) {
         const dropCoordinates = [...this.coordinates];
         dropCoordinates[dropCoordinates.length - 1]++;
         this.limbleTreeService.showDropZoneFamily({
            container: this.dropZoneBelow,
            coordinates: dropCoordinates
         });
      } else if (
         event.offsetY <= dividingLine &&
         this.dropZoneAbove !== undefined &&
         this.dropZoneService.getActiveDropZoneInfo()?.container !==
            this.dropZoneAbove
      ) {
         const dropCoordinates = [...this.coordinates];
         this.limbleTreeService.showDropZoneFamily({
            container: this.dropZoneAbove,
            coordinates: dropCoordinates
         });
      }
   }

   private renderSelf() {
      if (this.nodeHost === undefined || this.component === undefined) {
         throw new Error("Failed to render tree node");
      }
      const componentRef = this.componentCreatorService.appendComponent<any>(
         this.component.class,
         this.nodeHost
      );
      componentRef.instance.nodeData = this.nodeData;
      for (const binding in this.component.bindings) {
         componentRef.instance[binding] = this.component.bindings[binding];
      }
   }

   private renderChildren() {
      if (
         this.childNodes &&
         this.childNodes.length > 0 &&
         this.children !== undefined
      ) {
         if (this.coordinates === undefined) {
            throw new Error("coordinates are undefined");
         }
         const newBranch = this.componentCreatorService.appendComponent<LimbleTreeComponent>(
            LimbleTreeComponent,
            this.children
         );
         newBranch.instance.treeData = {
            nodes: this.childNodes,
            options: this.treeRendererService.getTreeData().options
         };
         newBranch.instance.indent =
            this.treeRendererService.getTreeData().options?.indent ?? INDENT;
         newBranch.instance.coordinates = [...this.coordinates];
      }
   }

   private registerDropZones() {
      if (
         this.dropZoneAbove === undefined ||
         this.dropZoneBelow === undefined ||
         this.coordinates === undefined
      ) {
         throw new Error("failed to register drop zones");
      }
      const dropCoordinatesAbove = [...this.coordinates];
      this.dropZoneService.addDropZone({
         container: this.dropZoneAbove,
         coordinates: dropCoordinatesAbove
      });
      const dropCoordinatesBelow = [...this.coordinates];
      dropCoordinatesBelow[dropCoordinatesBelow.length - 1]++;
      this.dropZoneService.addDropZone({
         container: this.dropZoneBelow,
         coordinates: dropCoordinatesBelow
      });
   }
}
