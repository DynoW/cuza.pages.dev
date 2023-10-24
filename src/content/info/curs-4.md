---
title: "Curs-4"
description: "cmmdc/cmmmc"
---

Varianta I - împarțiri repetate (Euclid):
```cpp
if(a*b==0){
    cmmdc=a+b;
} else {
    D = a;
    I = b;
    R = D%I;
    while(R!=0){
        D=I;
        I=R;
        R=D%I;
    }
    cmmdc = I;
}
cmmmc = a*b/cmmdc;
```

Varianta II - scăderi repetate:
```cpp
ca=a;
cb=b;
if(a*b==0){
    cmmdc=a+b;
} else {
    while(a!=b){
        if(a>b)
            a=a-b;
        else
            b=b-a;
    }
    cmmdc=0;
}
cmmmc = a*b/cmmdc;
```
