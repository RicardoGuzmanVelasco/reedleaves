import { startReader } from "./reader-app.mjs?v=daily-streak-flame-2";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
