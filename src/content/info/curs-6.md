---
title: "Curs-6"
description: "Factori primi"
---

## Exemplu

`90 = 2^1 * 3^2 * 5^1`

| Pas | n înainte | d   | p după împărțiri |
| --- | --------- | --- | ---------------- |
| 1   | 90        | 2   | 1                |
| 2   | 45        | 3   | 2                |
| 3   | 5         | 5   | 1                |

## Varianta I

```cpp
d = 2;
while(n != 1){
    p = 0;
    while(n % d == 0){
        n = n/d;
        p++;
    }
    if(p != 0)
        // prelucrare p, d
        // ...
    d++;
}
```

## Varianta II (eficientă)

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
