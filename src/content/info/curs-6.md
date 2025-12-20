---
title: "Curs-6"
description: "Factori primi"
---

90=2^1\*3^2\*5^1

| n    | d   | p   |
| ---- | --- | --- |
| 90   | 2   | 0   |
| 45   |     | 1   |
| 15   | 3   | 0   |
| 5    |     | 1   |
|      | 4   | 0   |
| 1    | 5   | 0   |
|      |     | 1   |

Varianta I:
```cpp
d = 2;
while(n != 1){
    p = 0;
    while(n % 2 == d){
        n = n/d;
        p++;
    }
    if(p != 0)
        // prelucrare p, d
        // ...
    d++;
}
```

Varianta II (eficientă):
```cpp
d = 2;
while(d * d <= n){
    p = 0;
    while(n % d == 0){
        p++;
        n = n / d;
    }
    if(p != 0){
        // prelucrare p, d
        // ...
    }
    d++;
}
if(n != 1){
    // prelucrare n^1
    // ...
}
```
