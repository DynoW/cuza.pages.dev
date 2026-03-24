---
title: "Curs-4"
description: "Verificare număr prim"
---

## Varianta I

```cpp
nrd = 0;
for(d = 1; d <= n; d++)
    if(n % d == 0)
        nrd++;
if(nrd == 2)
    // prelucrare n
    // ...
```

## Varianta II (eficientă)

```cpp
nrd = 0;
for(d = 1; d * d < n; d++)
    if(n % d == 0)
        nrd = nrd + 2;
if(d * d == n)
    nrd++;
if(nrd == 2)
    // prelucrare n
    // ...
```
