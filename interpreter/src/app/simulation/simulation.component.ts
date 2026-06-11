import { Component, input, OnInit } from '@angular/core';
import { Interpretation, Stream, StreamValue } from 'src/assets/Interpretation';
import { VSCode } from 'src/assets/VSCode';

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




  public showArrayEditor: boolean = false;
  public currentStream: Stream | null = null;
  public unsavedValues: string[] | string[][] = [];
  public arrayValues: StreamValue[] = [];

  public getColIndices(): number[] {
    if (this.currentStream?.typeInfo.sizes.length === 2) {
      return Array.from({ length: this.currentStream?.typeInfo.sizes[1] }, (_, i) => i);
    } else if (this.currentStream?.typeInfo.sizes.length === 1) {
      return [-1];
    } else {
      return [];
    }
  }

  public getRowIndices(): number[] {
      return Array.from({ length: this.currentStream?.typeInfo.sizes[0] }, (_, i) => i);
   
  }

  public getArrayValue(row: number, col?: number): string | boolean {
    let ret: string = "";
    if(col !== undefined && col !== -1) {
      ret = (this.unsavedValues as string[][])[row][col];
    } else {
      ret = (this.unsavedValues as string[])[row];
    }
    if (this.currentStream?.typeInfo.baseType === 'bool') {
      return ret === "true";
    }
    return ret;
  }
  public getValueFromEvent(event: Event): string {
    if(this.currentStream?.typeInfo.baseType === 'bool') {
      return (event.target as HTMLInputElement).checked ? "false" : "true";
    }
    return (event.target as HTMLInputElement).value;
  }
  public arrayValueChanged( event: Event, row: number, col?: number): void {
    if(this.currentStream?.type == undefined){
      console.error("Current stream type is undefined");
      return;
    }
    if(col !== -1 && col !== undefined) {
      (this.unsavedValues as string[][])[row][col] = this.getValueFromEvent(event);
    } else{
      this.unsavedValues[row] = this.getValueFromEvent(event);

    }
  }
  public openArrayEditor(stream: Stream, values: StreamValue[]): void {
    this.currentStream = stream;
    

    if(values[1] !== undefined){
      this.arrayValues = values[1] as StreamValue[];
    } else {
      this.arrayValues = this.createNDimensionalArray(this.currentStream.typeInfo.sizes, "");
    }
    let numDims = this.currentStream.typeInfo.sizes.length;
    if(numDims === 1) {
      for (let i = 0; i < this.arrayValues.length; i++) {
          this.unsavedValues[i] = this.arrayValues[i].toString(); 
      }
    } else if(numDims === 2) {
      this.unsavedValues = this.arrayValues.map(row => (row as StreamValue[]).map(value => value.toString()));
    } else {
      return;
    }

    this.showArrayEditor = true;
  }

  public closeArrayEditor(): void {
    this.showArrayEditor = false;
    this.currentStream = null;
    this.arrayValues = [];
    this.unsavedValues = [];
  }

  public saveArray(): void {
    const is2D = Array.isArray(this.unsavedValues[0]);
    if(is2D){
      for (let i = 0; i < (this.unsavedValues as string[][]).length; i++) {
        const row = (this.unsavedValues as string[][])[i];
        for (let j = 0; j < row.length; j++) {
          (this.arrayValues[i] as StreamValue[])[j] = this.getValueFromString(row[j], this.currentStream?.typeInfo.baseType);
        }
      }
    }else {
      this.unsavedValues.forEach((value, index) => {
        this.arrayValues[index] = this.getValueFromString(value as string, this.currentStream?.typeInfo.baseType);
        
      });
    }

    this.closeArrayEditor();
  }
  public showViewArrayButton(stream: Stream): boolean {
    if(stream.class === "output") {
        return stream.instantValues.some(value => value.length > 1);
    } 
    return true;
  }
  public showViewSetButton(stream: Stream): boolean {
     if(stream.class === "output") {
        return stream.instantValues.some(value => value.length > 1);
    } 
    return true;
  }

    public showViewMapButton(stream: Stream): boolean {
     if(stream.class === "output") {
        return stream.instantValues.some(value => value.length > 1);
    } 
    return true;
  }




  public showSetEditor: boolean = false;
  public currentSetStreamInstant: StreamValue[] = [];
  public currentSetValues: StreamValue[] = [];
  public unsavedSetValues: string[] = [];
  public currentSetStream: Stream | null = null;

  public openSetEditor(stream: Stream, values: StreamValue[]): void {
    this.currentSetStreamInstant = values;
    this.currentSetStream = stream;
    if(values[1] !== undefined){
      this.currentSetValues = values[1] as StreamValue[];
    } else {
      this.currentSetValues = [];
    }
    this.unsavedSetValues = this.currentSetValues.map(v => v.toString());


    this.showSetEditor = true;
    console.log("Set editor opened for stream:", stream.name, "with values:", values);
  }

  public addSetElement(): void {
    if(this.currentSetValues == null){
      console.error("Current set stream is null");
      return;
    }
    this.unsavedSetValues.push("");
  }

  public setElementChanged(i:number, event: Event): void {
    if(this.unsavedSetValues == null){
      console.error("Current set stream is null");
      return;
    }
    this.unsavedSetValues[i] = this.getValueFromEvent(event);
  } 
  public removeSetElement(index: number): void {  
    if(this.currentSetValues == null){
      console.error("Current set stream is null");
      return;
    }
    this.unsavedSetValues.splice(index, 1);
  }
  public closeSetEditor(): void {
    this.showSetEditor = false;
    this.unsavedSetValues = [];
  }

  public saveSet(): void {
    this.currentSetValues = this.unsavedSetValues.map(value => this.getValueFromString(value, this.currentSetStream?.typeInfo.baseType));
    this.currentSetStreamInstant[1] = this.currentSetValues;
    this.closeSetEditor();
  }






  public getMapKeyType(stream: Stream): string {
      return (
        stream.typeInfo?.keyType 
      );
    }

  public getMapValueType(stream: Stream): string {
    return (
      stream.typeInfo?.valueType
    );
  }



  public showMapEditor: boolean = false;

  public currentMapStreamInstant: StreamValue[] = [];
  public currentMapStream: Stream | null = null;

  public currentMapValues: StreamValue[][] = [];
  public unsavedMapValues: string[][] = [];


  public openMapEditor(stream: Stream, values: StreamValue[]): void {
  this.currentMapStreamInstant = values;
  this.currentMapStream = stream;

  if (values[1] !== undefined) {
    this.currentMapValues = values[1] as StreamValue[][];
  } else {
    this.currentMapValues = [];
  }

  this.unsavedMapValues = this.currentMapValues.map(entry => [
    this.valueToString(entry[0])?.toString() ?? "",
    this.valueToString(entry[1])?.toString() ?? ""
  ]);

  this.showMapEditor = true;

  console.log("Map editor opened for stream:", stream.name, "with values:", values);
}

public addMapEntry(): void {
  if (this.currentMapStream === null) {
    console.error("Current map stream is null");
    return;
  }

  this.unsavedMapValues.push(["", ""]);
}

public mapKeyChanged(index: number, event: Event): void {
  if (this.currentMapStream === null) {
    console.error("Current map stream is null");
    return;
  }

  this.unsavedMapValues[index][0] = (event.target as HTMLInputElement).value;
}

public mapValueChanged(index: number, event: Event): void {
  if (this.currentMapStream === null) {
    console.error("Current map stream is null");
    return;
  }

  this.unsavedMapValues[index][1] = (event.target as HTMLInputElement).value;
}

public removeMapEntry(index: number): void {
  if (this.currentMapStream === null) {
    console.error("Current map stream is null");
    return;
  }

  this.unsavedMapValues.splice(index, 1);
}

public closeMapEditor(): void {
  this.showMapEditor = false;
  this.currentMapStream = null;
  this.currentMapStreamInstant = [];
  this.currentMapValues = [];
  this.unsavedMapValues = [];
}

public saveMap(): void {
  if (this.currentMapStream === null) {
    console.error("Current map stream is null");
    return;
  }

  const keyType = this.getMapKeyType(this.currentMapStream);
  const valueType = this.getMapValueType(this.currentMapStream);

  this.currentMapValues = this.unsavedMapValues.map(entry => {
    const key = this.getValueFromString(entry[0], keyType);
    const value = this.getValueFromString(entry[1], valueType);

    return [key, value];
  });

  this.currentMapStreamInstant[1] = this.currentMapValues;

  this.closeMapEditor();
}
}





declare const vscode: VSCode;
