---
title: "Curs-3"
description: "Factori primi"
---

Varianta I:
```cpp
d=0;
while(n!=1){
    n=0;
    while(n%d==0){
        p++;
        n=n/d;
    }
    if(p){
        // prelucrare p, d
        // ...
    }
    d++;
}
```

Varianta II (eficientă):
```cpp
d=2;
while(d*d<=n){
    p=0;
    while(n%d==0){
        p++;
        n=n/d;
    }
    if(p!=0){
        // prelucrare p, d
        // ...
    }
    d++;
}
if(n!=1){
    // prelucrare n^1
    // ...
}
```
