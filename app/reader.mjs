import { startReader } from "./reader-app.mjs?v=collection-domains-4";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
