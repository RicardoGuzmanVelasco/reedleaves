import { startReader } from "./reader-app.mjs?v=currency-cycle-countdown-1";
import {createCardFeaturesBridge} from "./generated/card-features.js";

startReader({createCardFeatures:createCardFeaturesBridge});
