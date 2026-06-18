import { Component, input, OnInit } from '@angular/core';
import { Interpretation, Stream, StreamValue } from 'src/assets/Interpretation';
import { VSCode } from 'src/assets/VSCode';

type EditorKind = "1Darray" | "2Darray" | "set" | "map" | null;
type Editor = {
  id: number;
  editorKind: EditorKind;
  stream: Stream;
  indexes: number[]
  valueType: string,
  streamValues: StreamValue[]
  unsavedValues : StreamValue[];
}

@Component({
    selector: 'app-simulation',
    templateUrl: './simulation.component.html',
    styleUrls: ['./simulation.component.css'],
    standalone: false
})
export class SimulationComponent implements OnInit {

  private _uri: string;
  private _main: string;
  private _components: Interpretation[];
  private _ndVars: any[];
  private _interp_mode: string;
  
  public constructor() {
    this._interp_mode = "interp";
    this._ndVars = [];
    this._uri = "";
    this._main = "";
    this._components = [];
    // Handle the message inside the webview
    window.addEventListener('message', event => {
      console.log(event);
      if (event.data.uri !== undefined && event.data.main !== undefined && event.data.json !== undefined && event.data.type !== undefined) {
        this._uri = event.data.uri;
        this._main = event.data.main;
        this._interp_mode = event.data.type;
        let json_data: any;
        try {
          json_data = JSON.parse(event.data.json)[0];
          console.log("Received data:", this._uri, this._main, json_data);
          } catch (e) {
          
          vscode.postMessage({ command: "showErrorMessage", text: "Kind 2 Error", internalError: JSON.stringify(event.data.json) });
          
          return;
        }
          
          this._ndVars = this.nonDeterministicVarsOf(json_data).map( (nd_var) => {return nd_var.name} ); 
          this._components = this.flatten(json_data);

      }
    });
    vscode.postMessage("ready");
  }

  public get components(): Interpretation[] {
    return this._components;
  }
  //This function only works if constants with a definition are taken out of the interpreter trace.
  private nonDeterministicVarsOf(json: any) {
    let streams : Array<any> = json.streams;
    let nd_streams : Array<any> = streams.filter((stream) => {
      let instant_values: Array<any> = stream.instantValues
      console.log(`Stream ${JSON.stringify(stream)} with instantValues ${instant_values} :: ${typeof instant_values}`); 
      return stream.instant_values == undefined && stream.class == "constant"; 
      }
    )
    return nd_streams;


  }
  public ngOnInit(): void {
  }

  private flatten(interp: Interpretation): Interpretation[] {
    let interps: Interpretation[] = [];
    let stack: Interpretation[] = [interp];
    while (stack.length !== 0) {
      let curr: Interpretation = stack.pop()!;
      interps.push(curr);
      if (curr.subnodes !== undefined) {
        for (let child of curr.subnodes.reverse()) {
          stack.push(child);
        }
      }
    }
    return interps;
  }

  public numCols(): number {
    let nCols = this._components[0].streams[0].instantValues.length;
    if (nCols == 0) {
      nCols = 10;
      this.changeColumns(nCols);
    }
    return nCols;
  }

  private hasND() : boolean {
    return this._ndVars.length > 0;
  }

  public isDisabled(component: Interpretation, stream: Stream): boolean {
    return this.hasND() || component !== this._components[0] || stream.class !== "input";
  }

  public valueToString(value: any): string | String | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value.num !== undefined && value.den !== undefined) {
      return value.num.toString() + "/" + value.den.toString();
    }
    if(Array.isArray(value)) {
      return "[" + value.map(v => this.valueToString(v)).join(",") + "]";
    }
    if(typeof value === "boolean") {
      return value ? "true" : "false";

    }
    return value.toString();
  }

  public checkboxChanged(component: Interpretation, stream: Stream, value: (StreamValue)[], event: Event): void {
    if (this.isDisabled(component, stream)) {
      if (typeof value[1] === "boolean") {
        (event.target as HTMLInputElement).checked = value[1];
      }
    } else {
      value[1] = (event.target as HTMLInputElement).checked;
    }
  }
  public getValueFromString(val: string, type: string): StreamValue {
    switch (type) {
      case "int":
      case "subrange":
        return Number.parseInt(val);
        break;
      case "real":
        let i = val.indexOf("/");
        if (i === -1) {
          return Number.parseFloat(val);
        } else {
          return { num: Number.parseInt(val.substring(0, i)), den: Number.parseInt(val.substring(i + 1)) };
        }
        break;
      case "enum":
        return val;
        break;
      case "array":
        console.error("Array input not implemented yet");
        return Number.parseInt(val);
      case "bool":
        return val === "true";
      default:
        console.error("Unknown type: " + type);
        return -1;
    }
  }
  public inputChanged(type: string, value: (StreamValue)[], event: Event): void {
    
     switch (type) {
      case "bool":
        value[1] = (event.target as HTMLInputElement).checked;
        break;
      case "int":
      case "real":
      case "enum":
      case "array":
      case "subrange":
        value[1] = this.getValueFromString((event.target as HTMLInputElement).value, type);
        break;
      default:
        console.error("Unknown type: " + type);
    }
  }

  public columnsChangedEvent(event: Event): void {
    this.changeColumns(Number.parseInt((event.target as HTMLInputElement).value));
  }

  private changeColumns(nCols: number): void {
    if (nCols < this._components[0].streams[0].instantValues.length) {
      for (let component of this._components) {
        for (let stream of component.streams) {
          stream.instantValues.splice(nCols);
        }
      }
    }
    else {
      for (let stream of this._components[0].streams) {
        for (let i = stream.instantValues.length; i < nCols; ++i) {
          if (stream.class === "input") {
            switch (stream.type) {
              case "bool":
              case "int":
              case "real":
              case "enum":
              case "array":
              case "subrange":
              case "set":
              case "map":
                stream.instantValues.push([i, this.defaultValueFor(stream.type, stream.typeInfo)]);
                break;
            }
          } else {
            stream.instantValues.push([i]);
          }
        }
      }
      for (let component of this._components.slice(1)) {
        for (let stream of component.streams) {
          for (let i = stream.instantValues.length; i < nCols; ++i) {
            stream.instantValues.push([i]);
          }
        }
      }
    }
  }

  public defaultValueFor(type: string, typeInfo: any): StreamValue {
    switch (type) {
      case "bool":
        return false;
      case "int":
        return 0;
      case "real":
        return 0.0;
      case "enum":
        return  typeInfo.values[0];
      case "array":
        return this.createNDimensionalArray(typeInfo.sizes, this.defaultValueFor(typeInfo.baseType, typeInfo.baseTypeInfo));
      case "subrange":
        return typeInfo.min ?? typeInfo.max;
      case "set":
      case "map":
        return [];
      default:
        console.error("Unknown type: " + type);
        return -1;
    }
  }

  private createNDimensionalArray(sizes: number[], defaultValue: any = 0): any {
 
  
  if (sizes.length === 1) {
    return Array.from({length: sizes[0]}, () => defaultValue);
  }
  
  const [currentSize, ...remainingSizes] = sizes;
  return Array.from({length: currentSize}, () => 
    this.createNDimensionalArray(remainingSizes, defaultValue)
  );
}
  

  public simulateErrorMessage(): string { //could add more error messages here
    return this.hasND() ? `Cannot simulate nondeterministic systems (Variables: ${this._ndVars.join(", ")})` : "";

  }
  public simulateIsDisabled(): boolean { //could add more cases where simulating is not allowed
    return this.hasND() || this.isCexMode();
  }
  public isCexMode(): boolean {
    return this._interp_mode == "cex";
  }
  private detupleStreams(streams: Stream[]): Stream[] {
    let new_streams: Stream[] = [];
    for (let stream of streams) {
      if (stream.type === "map") {
        let new_stream = { ...stream, name: stream.name.split("_").slice(0, -1).join("_") };  
        new_streams.push(new_stream);
      }
        else {
          new_streams.push(stream);
        }
    }
    return new_streams;
  }
  public simulate(): void {
    if(this.hasND()){
      // this should not be reachable by the simulate button since the 
      // simulate button should be disabled if nondeterministic vars are found
      vscode.postMessage({
        command: "showErrorMessage", 
        text : `Cannot simulate nondeterministic systems (Variables: ${this._ndVars.join(", ")})`
      });
      return;
    }
    let json: any[] = new Array();
    let mainComponent: Interpretation = this._components[0];
    let inputStreams: Stream[] = mainComponent.streams.filter(stream => stream.class === "input");
    inputStreams = this.detupleStreams(inputStreams);
    let time: number = this._components[0].streams[0].instantValues.length;
    for (let i = 0; i < time; ++i) {
      let object: any = {};
      for (let stream of inputStreams!) {
        if (stream.name.includes(".")) {
          const path = stream.name.split(".");
          let subObj = object;
          for (let j = 0; j < path.length - 1; j++) {
            const name = path[j];
            if (subObj[name] === undefined) {
              subObj[name] = {};
            }
            subObj = subObj[name];
          }
          subObj[path[path.length - 1]] = stream.instantValues[i][1];
        }  else {
          object[stream.name] = this.valueToJSON(stream.instantValues[i][1]);
        }
      }
      json.push(object);
    }
    console.log("Simulating with JSON:", JSON.stringify(json));
    vscode.postMessage({ command: "kind2/interpret", args: [{ uri: this._uri, name: this._main }, JSON.stringify(json)] });
  }
  public valueToJSON(value: any): string | String | any[] | boolean | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value.num !== undefined && value.den !== undefined) {
      return value.num.toString() + "/" + value.den.toString();
    }
    if(Array.isArray(value)) {
      return value;
    }
    if(typeof value === "boolean") {
      return value;

    }
    console.log("Sending interpreter input:\n", value.toString())
    return value.toString();
  }



  openEditors: Editor[] = [];
  private getCurrOpenIndexes() : number[]{
    let idxs = this.openEditors.at(-1)?.indexes;
    if (idxs == undefined){
      return [];
    } 
    return idxs;
  }
  private nextEditorID: number = 1;
  trackEditorById(index: number, editor: Editor): number {
    return editor.id;
  }
  formatArrayName(editor: Editor) : string {
    let indexes = this.formatArrayIndexes(editor);
    return (indexes.length == 0 ? "" : "(") +
           editor.stream.name + " : " + this.formatArrayType(editor) + 
           (indexes.length == 0 ? "":  ")" + indexes);
  }
  private formatArrayIndexes(editor: Editor): string {
    let indexes = editor.indexes;
    if (indexes.length == 0) {
      return "";
    } else {
      return "[" + indexes.join("][") + "]";
    }
  }
  private formatArrayType(editor: Editor): string {
    const typeInfo = editor.stream?.typeInfo;

    if (!typeInfo?.sizes) {
      return "";
    }

    return `${typeInfo.baseType}^${typeInfo.sizes.slice().reverse().join("^")}`;
  }

  public getRowIndices(editor: Editor): number[] {
    let result = Array.from({length: editor.streamValues.length}, (_, n) => n);
      console.log("Getting row indicies", result);
      return result;
   
  }
  
   public getNestedArrayValue(editor: Editor, row: number, col?: number): StreamValue[] {
    let ret: StreamValue;
    if (editor.editorKind === "1Darray"){
      ret = (editor.unsavedValues as StreamValue[][])[row];
    } else {
      throw new Error("editor is not an array editor but is being handled like one. Or mismatch between 1D and 2D array"+editor.editorKind + col)
    }
    return ret;
  }
  public getArrayValue(editor: Editor, row: number): StreamValue {
    let ret: StreamValue;
    if (editor.editorKind === "1Darray"){
      ret = (editor.streamValues)[row];
    } else {
      throw new Error("editor is not an array editor but is being handled like one. Or mismatch between 1D and 2D array"+editor.editorKind)
    }
    return ret;
  }
  public getValueFromEvent(editor:Editor, event: Event): StreamValue {
    if(editor.stream?.typeInfo.baseType === 'bool') {
      return (event.target as HTMLInputElement).checked ? true : false;
    }
    return this.getValueFromString((event.target as HTMLInputElement).value, editor.stream?.typeInfo.baseType);
  }
  public arrayValueChanged( editor: Editor, event: Event, row: number): void {
    if(editor.stream?.type == undefined){
      console.error("Current stream type is undefined");
      return;
    }
      editor.unsavedValues[row] = this.getValueFromEvent(editor, event);
  }
  public openArrayEditor(stream: Stream, values: StreamValue[], atIndex: number | undefined): void {
    let arrayValues: StreamValue[];
    let newIndexes: number[];
    if (atIndex === undefined){
      arrayValues =  values[1] as StreamValue[];
      newIndexes = [];
    } else {
      arrayValues = values as StreamValue[];
      newIndexes = [...this.getCurrOpenIndexes(), atIndex];
    }
    console.log("Values: ", values)
    // if(values[1] !== undefined){
    //   arrayValues = values[1] as StreamValue[];
    // } else {
    //   arrayValues = this.createNDimensionalArray(stream.typeInfo.sizes, "");
    // }
    let numDims = stream.typeInfo.sizes.length;
    let unsavedValues;
    let editorKind: EditorKind;
    // if(numDims === 2) {
    //   editorKind = "2Darray";
    //   arrayValues = values[1] as StreamValue[];
    //   unsavedValues = arrayValues.map(row => (row as StreamValue[]).map(value => value.toString()));
    // } else {
      unsavedValues = [];
     
      editorKind = "1Darray";
      for (let i = 0; i < arrayValues.length; i++) {
          unsavedValues[i] = arrayValues[i]; 
      }
      let valueType: string;
      if(stream.typeInfo.sizes.length - newIndexes.length  > 1){
        valueType = "array"
      } else {
        valueType = stream.typeInfo.baseType;
      }
    // }
    let newEditor = {
        id: this.nextEditorID++,
        stream: stream,
        streamValues: arrayValues,
        indexes: newIndexes,
        valueType: valueType,
        unsavedValues: unsavedValues,
        editorKind: editorKind
      };

    this.openEditors.push(
      newEditor
    )
    console.log("Opened editor:", JSON.stringify(newEditor));
    console.log(this.openEditors.length, "editors open");
  }

  public closeArrayEditor(): void {
    this.openEditors.pop();
  }

  public saveArray(editor : Editor): void {
    console.log("Trying to save", editor.unsavedValues, "to", editor.streamValues);
    
     if(editor.valueType === "array"){
          editor.unsavedValues.forEach((value, index) => {
            editor.streamValues[index] = value;
          });
     } else {
      editor.unsavedValues.forEach((value, index) => {
        editor.streamValues[index] = value;
        
      });
    }
      console.log("Stream values are now", editor.stream.instantValues[1]);

    this.closeArrayEditor();
  }

  public getColIndices2D(editor: Editor): number[] {
    return Array.from({ length: editor.stream?.typeInfo.sizes[1] }, (_, i) => i);
    
  }

  public getRowIndices2D(editor: Editor): number[] {
      return Array.from({ length: editor.stream?.typeInfo.sizes[0] }, (_, i) => i);
  }
  //  public getNestedArrayValue2D(editor: Editor, row: number, col?: number): StreamValue[] {
  //   let ret: StreamValue;
  //   if (editor.editorKind === "1Darray"){
  //     ret = (editor.streamValues as StreamValue[][])[row];
  //   } else {
  //     throw new Error("editor is not an array editor but is being handled like one. Or mismatch between 1D and 2D array"+editor.editorKind + col)
  //   }
  //   return ret;
  // }
  public getArrayValue2D(editor: Editor, row: number, col?: number): StreamValue {
    let ret: StreamValue;
    if(editor.editorKind === "2Darray" && col != undefined) {
      ret = (editor.streamValues as StreamValue[][])[row][col];
    } else {
      throw new Error("editor is not an array editor but is being handled like one. Or mismatch between 1D and 2D array"+editor.editorKind + col)
    }
    return ret;
  }
  public arrayValueChanged2D( editor: Editor, event: Event, row: number, col?: number): void {
    if(editor.stream?.type == undefined){
      console.error("Current stream type is undefined");
      return;
    }
    if(editor.editorKind === "2Darray" && col !== undefined) {
      (editor.unsavedValues as StreamValue[][])[row][col] = this.getValueFromEvent(editor, event);
    } else{
      editor.unsavedValues[row] = this.getValueFromEvent(editor, event);

    }
  }
 
  public saveArray2D(editor : Editor): void {
    if(editor.editorKind === "2Darray"){
      for (let i = 0; i < (editor.unsavedValues as string[][]).length; i++) {
        const row = (editor.unsavedValues as string[][])[i];
        for (let j = 0; j < row.length; j++) {
          (editor.streamValues[i] as StreamValue[])[j] = this.getValueFromString(row[j], editor.stream?.typeInfo.baseType);
        }
      }
    }

    this.closeArrayEditor();
  }
  public showViewArrayButton(stream: Stream): boolean {
    if(stream.class === "output") {
        return stream.instantValues.some(value => value.length > 1);
    } 
    return true;
  }
  


//   public showViewSetButton(stream: Stream): boolean {
//      if(stream.class === "output") {
//         return stream.instantValues.some(value => value.length > 1);
//     } 
//     return true;
//   }

//     public showViewMapButton(stream: Stream): boolean {
//      if(stream.class === "output") {
//         return stream.instantValues.some(value => value.length > 1);
//     } 
//     return true;
//   }

  
 

//   public openSetEditor(stream: Stream, values: StreamValue[]): void {
//     this.currentSetStreamInstant = values;
//     this.currentSetStream = stream;
//     if(values[1] !== undefined){
//       this.currentSetValues = values[1] as StreamValue[];
//     } else {
//       this.currentSetValues = [];
//     }
//     this.unsavedSetValues = this.currentSetValues.map(v => v.toString());


//     this.showSetEditor = true;
//     console.log("Set editor opened for stream:", stream.name, "with values:", values);
//   }

//   public addSetElement(): void {
//     if(this.currentSetValues == null){
//       console.error("Current set stream is null");
//       return;
//     }
//     this.unsavedSetValues.push("");
//   }

//   public setElementChanged(i:number, event: Event): void {
//     if(this.unsavedSetValues == null){
//       console.error("Current set stream is null");
//       return;
//     }
//     this.unsavedSetValues[i] = this.getValueFromEvent(event);
//   } 
//   public removeSetElement(index: number): void {  
//     if(this.currentSetValues == null){
//       console.error("Current set stream is null");
//       return;
//     }
//     this.unsavedSetValues.splice(index, 1);
//   }
//   public closeSetEditor(): void {
//     this.showSetEditor = false;
//     this.unsavedSetValues = [];
//   }

//   public saveSet(): void {
//     this.currentSetValues = this.unsavedSetValues.map(value => this.getValueFromString(value, this.currentSetStream?.typeInfo.baseType));
//     this.currentSetStreamInstant[1] = this.currentSetValues;
//     this.closeSetEditor();
//   }






//   public getMapKeyType(stream: Stream): string {
//       return (
//         stream.typeInfo?.keyType 
//       );
//     }

//   public getMapValueType(stream: Stream): string {
//     return (
//       stream.typeInfo?.valueType
//     );
//   }



 


//   public openMapEditor(stream: Stream, values: StreamValue[]): void {
//   this.currentMapStreamInstant = values;
//   this.currentMapStream = stream;

//   if (values[1] !== undefined) {
//     this.currentMapValues = values[1] as StreamValue[][];
//   } else {
//     this.currentMapValues = [];
//   }

//   this.unsavedMapValues = this.currentMapValues.map(entry => [
//     this.valueToString(entry[0])?.toString() ?? "",
//     this.valueToString(entry[1])?.toString() ?? ""
//   ]);

//   this.showMapEditor = true;

//   console.log("Map editor opened for stream:", stream.name, "with values:", values);
// }

// public addMapEntry(): void {
//   if (this.currentMapStream === null) {
//     console.error("Current map stream is null");
//     return;
//   }

//   this.unsavedMapValues.push(["", ""]);
// }

// public mapKeyChanged(index: number, event: Event): void {
//   if (this.currentMapStream === null) {
//     console.error("Current map stream is null");
//     return;
//   }

//   this.unsavedMapValues[index][0] = (event.target as HTMLInputElement).value;
// }

// public mapValueChanged(index: number, event: Event): void {
//   if (this.currentMapStream === null) {
//     console.error("Current map stream is null");
//     return;
//   }

//   this.unsavedMapValues[index][1] = (event.target as HTMLInputElement).value;
// }

// public removeMapEntry(index: number): void {
//   if (this.currentMapStream === null) {
//     console.error("Current map stream is null");
//     return;
//   }

//   this.unsavedMapValues.splice(index, 1);
// }

// public closeMapEditor(): void {
//   this.showMapEditor = false;
//   this.currentMapStream = null;
//   this.currentMapStreamInstant = [];
//   this.currentMapValues = [];
//   this.unsavedMapValues = [];
// }

// public saveMap(): void {
//   if (this.currentMapStream === null) {
//     console.error("Current map stream is null");
//     return;
//   }

//   const keyType = this.getMapKeyType(this.currentMapStream);
//   const valueType = this.getMapValueType(this.currentMapStream);

//   this.currentMapValues = this.unsavedMapValues.map(entry => {
//     const key = this.getValueFromString(entry[0], keyType);
//     const value = this.getValueFromString(entry[1], valueType);

//     return [key, value];
//   });

//   this.currentMapStreamInstant[1] = this.currentMapValues;

//   this.closeMapEditor();
// }
}





declare const vscode: VSCode;
