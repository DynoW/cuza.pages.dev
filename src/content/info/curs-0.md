---
title: "Curs-0"
description: "Citire de nr."
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

Varianta III - pană la finalul fișierului (End Of File):
```cpp
// ! Nu uita sa imporți librăria !
#include <fstream>
ifstream f("fisier.txt");
```
```cpp
while(f>>n){
    // prelucrare n
}
```