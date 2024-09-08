---
title: "Curs-3"
description: "Suma divizorilor."
---

Varianta I:
```cpp
nrd = 0;
for(d = 1; d<=n; d++)
    if(n % d == 0)
        nrd++;
```

Varianta II (eficientă):
```cpp
s = 0;
for(d = 1; d * d < n; d++)
    if(n % d == 0)
        s = s + d + n / d;
if(d * d == n)
    s = s + d;
```