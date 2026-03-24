---
title: "Curs-vectori-5"
description: "Interclasare"
---

## Implementare (pentru șiruri ordonate)

```cpp
i=0;
j=0;
k=0;
while(i<n && j<m){
    if(a[i]<b[j]){
        c[k]=a[i]; // sau c[k++]=a[i++]
        k++;
        i++;
    } else {
        c[k]=b[j]; // sau c[k++]=b[j++]
        k++;
        j++;
    }
}
while(i<n){c[k]=a[i];k++;i++;}
while(j<m){c[k]=b[j];k++;j++;}
```
