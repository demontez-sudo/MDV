/* Stability: writes that change nothing (setAttribute with the same value, adding a class that is already there, setting
   hidden/className to the same value) still make the browser queue a DOM mutation record. Several older scripts watch the
   whole page for mutations and answer by writing the same attributes back, which kept the portal in a permanent re-render
   loop (thousands of mutations a second, one page frozen outright). Skipping writes that change nothing breaks those loops
   and has no other visible effect. Loaded first, before any other script. */
(function(){
'use strict';
if(window.__MDV_NOOP_GUARD__)return;window.__MDV_NOOP_GUARD__=true;
try{
  var E=Element.prototype,sa=E.setAttribute,ga=E.getAttribute;
  E.setAttribute=function(n,v){v=String(v);if(ga.call(this,n)===v)return;return sa.call(this,n,v);};
  var DL=DOMTokenList.prototype,add=DL.add,rem=DL.remove,tog=DL.toggle;
  DL.add=function(){var a=arguments,i,all=true;for(i=0;i<a.length;i++){if(!this.contains(a[i])){all=false;break;}}if(all)return;return add.apply(this,a);};
  DL.remove=function(){var a=arguments,i,any=false;for(i=0;i<a.length;i++){if(this.contains(a[i])){any=true;break;}}if(!any)return;return rem.apply(this,a);};
  DL.toggle=function(t,force){if(force===undefined)return tog.call(this,t);var has=this.contains(t);if(!!force===has)return has;return tog.call(this,t,force);};
  var cn=Object.getOwnPropertyDescriptor(E,'className');
  if(cn&&cn.set){Object.defineProperty(E,'className',{configurable:true,enumerable:cn.enumerable,get:cn.get,set:function(v){if(cn.get.call(this)===String(v))return;cn.set.call(this,v);}});}
  var hd=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'hidden');
  if(hd&&hd.set){Object.defineProperty(HTMLElement.prototype,'hidden',{configurable:true,enumerable:hd.enumerable,get:hd.get,set:function(v){if(hd.get.call(this)===!!v)return;hd.set.call(this,v);}});}
}catch(e){}
})();
