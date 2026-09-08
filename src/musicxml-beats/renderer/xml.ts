import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import type { Document, Element } from "@xmldom/xmldom";
export const MEI = "http://www.music-encoding.org/ns/mei";
export const SVG = "http://www.w3.org/2000/svg";
export const XML = "http://www.w3.org/XML/1998/namespace";
export function parse(xml: string): Document {
  return new DOMParser({
    onError: (_level, message) => {
      throw new Error(message);
    },
  }).parseFromString(xml, "application/xml");
}
export const serialize = (node: Document | Element) =>
  new XMLSerializer().serializeToString(node);
export const all = (node: Document | Element, name: string): Element[] =>
  Array.from(node.getElementsByTagNameNS("*", name));
export const direct = (node: Element, name: string): Element[] =>
  Array.from(node.childNodes).filter(
    (n): n is Element => n.nodeType === 1 && n.localName === name
  );
export const id = (e: Element) =>
  e.getAttribute("xml:id") || e.getAttribute("id") || "";
export const byId = (node: Document | Element, value: string) =>
  all(node, "*").find((e) => id(e) === value);
export const classes = (e: Element) =>
  (e.getAttribute("class") || "").split(/\s+/);
