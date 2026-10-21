export type PrecinctPalette = {cream:string;trim:string;brick:string;navy:string;tile:string;gray:string;wood:string;dark:string;metal:string;paper:string;yellow:string;green:string;background:string};
export function precinctPalette(theme:'light'|'dark'):PrecinctPalette {
  return {cream:'#ded0a6',trim:'#374853',brick:'#7c8e97',navy:'#25364b',tile:'#d8cfaf',gray:'#8c9494',wood:'#77533b',dark:'#2d3234',metal:'#777e7b',paper:'#ede8d5',yellow:'#e5bd45',green:'#32654b',background:theme==='dark'?'#18232c':'#e9e7db'};
}
