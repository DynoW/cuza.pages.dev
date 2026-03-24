---
title: "Curs-3"
description: "Suma divizorilor"
---

## Varianta I

```cpp
s = 0;
for(d = 1; d<=n; d++)
    if(n % d == 0)
    s += d;
```

## Varianta II (eficientă)

```cpp
s = 0;
for(d = 1; d * d < n; d++)
    if(n % d == 0)
        s = s + d + n / d;
if(d * d == n)
    s = s + d;
```
