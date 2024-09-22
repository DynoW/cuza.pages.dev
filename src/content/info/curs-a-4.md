---
title: "Curs-vectori-4"
description: "Căutare binară"
---
(se aplică șirurior ordonate)

```cpp
OK=0;
ls=0;
ld=n-1;
do {
    mij = (ls+ld) / 2;
    if(v[mij]==x){
        OK=1;
    } else {
        if(v[mij]<x)
            ls = mij + 1;
        else
            ld = mij - 1;
    }
} while(OK=0 && ls<=ld);
```
