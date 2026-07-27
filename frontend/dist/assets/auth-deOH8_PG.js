import{c as a}from"./index-ZOR5b59D.js";/**
 * @license lucide-react v0.400.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const s=a("EyeOff",[["path",{d:"M9.88 9.88a3 3 0 1 0 4.24 4.24",key:"1jxqfv"}],["path",{d:"M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68",key:"9wicm4"}],["path",{d:"M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61",key:"1jreej"}],["line",{x1:"2",x2:"22",y1:"2",y2:"22",key:"a6p6uj"}]]);/**
 * @license lucide-react v0.400.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const i=a("Eye",[["path",{d:"M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z",key:"rwhkz3"}],["circle",{cx:"12",cy:"12",r:"3",key:"1v7zrd"}]]);async function o(t,e,n="Request"){if(t.status===401||t.status===403)return e;try{const r=await t.json();if(r&&typeof r.detail=="string")return r.detail}catch{}return`${n} failed: HTTP ${t.status}`}function d(t){const e=t.toLowerCase();return e.includes("failed to fetch")||e.includes("load failed")||e.includes("networkerror")||e.includes("network request failed")||e.includes("http 408")||e.includes("http 429")||e.includes("http 500")||e.includes("http 502")||e.includes("http 503")||e.includes("http 504")||e.includes("typeerror")?"Cannot reach the server. Check your connection and try again.":t}export{s as E,i as a,d as f,o as s};
