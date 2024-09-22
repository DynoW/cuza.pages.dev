---
title: "Curs-vectori-3"
description: "Eliminare / Adaugare în vector"
---

Eliminare:
```cpp
for(i=0;i<n;i++){
    if(v[i]%2==1){ // daca e impar
        for(j=i;j<n;j++)
            v[j]=v[j+1];
        n--;
        i--;
    }
}
```

Adaugare:
```cpp
for(i=0;i<n;i++){
    if(v[i]%2==1){ // daca e impar
        for(j=n;j>i;j--) // for(j=n;j>i+1;j--) pt adaugare dupa
            v[j]=v[j-1];
        n++;
        v[i]=2*v[i]; // pt adaugre 2*v[i]
        i++;
    }
}
```
