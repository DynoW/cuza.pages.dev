---
title: "Curs-vectori-2"
description: "Ordonare (Sortare)"
---

Varianta I:
```cpp
for(i=0;i<n-1;i++)
    for(j=i+1;j<n;j++)
        if(v[i]>v[j]) // <- descresc sau if(v[i]<v[j]) <- cresc
            swap(v[i],v[j]);
```

Varianta II - bubble sort:
```cpp
do {
    OK=1;
    for(i=0;i<n-1;i++){
        if(v[i]>v[i+1]){
            OK=0;
            swap(v[i],v[i+1]);
        }
    }
} while(OK==0);
```
