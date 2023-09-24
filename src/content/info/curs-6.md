---
title: "Curs-6"
description: "Citire de nr"
---

Varianta I - citire pană la 0:
```cpp
cin >> n;
while(n){
    // prelucrare n
    // ...
    cin >> n;
}
```

Varianta II - citire a n nr:
```cpp
cin >> n;
for(i=1;i<=n;i++){
    cin >> x;
    // prelucrare x
    // ...
}
```