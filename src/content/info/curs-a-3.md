---
title: "Curs-vectori-3"
description: "Eliminare / Adăugare în vector"
---

## Eliminare

```cpp
for(i=0;i<n;i++){
    if(v[i]%2==1){ // dacă e impar
        for(j=i;j<n;j++)
            v[j]=v[j+1];
        n--;
        i--;
    }
}
```

## Adăugare

```cpp
for(i=0;i<n;i++){
    if(v[i]%2==1){
        for(j=n;j>i;j--) // pentru adăugare după: j>i+1
            v[j]=v[j-1];
        n++;
        v[i]=2*v[i];
        i++;
    }
}
```
