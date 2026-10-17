import { startReader } from "./reader-app.mjs?v=hide-book-sources";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
