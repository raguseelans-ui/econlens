// The article page is assembled from these blocks, in this order. To add a section, write a block
// (an id, a contents-list label, and a render function) and add it here.
import data from "./data.js";
import summary from "./summary.js";
import theory from "./theory.js";
import terms from "./terms.js";
import practice from "./practice.js";
import discuss from "./discuss.js";

export const BLOCKS = [data, summary, theory, terms, practice, discuss];
