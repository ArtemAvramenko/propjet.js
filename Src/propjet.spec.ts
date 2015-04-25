class TestClass
{
    constructor()
    {
        propjet(this);
    }

    callCount = 0;

    backingValue = 0;

    backingFunction: (value?: number, oldValue?: number) => number;

    backingObject: TestClass;

    simpleGet = propjet<number>().
        get(() => this.backingValue).
        declare();

    cacheGet = propjet<number>().
        require(() => this.backingValue).
        get(
        () =>
        {
            this.callCount++;
            return this.backingValue;
        }).
        declare();

    fibonacciNumbers = propjet<number[]>().
        require().
        get(
        () =>
        {
            this.callCount++;
            var a = [0, 1];
            for (var i = 0; i < 100; i++)
            {
                a.push(a[i] + a[i + 1]);
            }
            return a;
        }).
        declare();

    objectValue = propjet<number>().
        require(() => this.backingObject).
        get(
        nested =>
        {
            this.callCount++;
            return nested ? nested.backingValue : NaN;
        }).
        declare();

    functionValue = propjet<number>().
        require(() => this.backingFunction).
        get(
        func =>
        {
            this.callCount++;
            return func();
        }).
        set(x => this.backingFunction(x)).
        declare();

    array = propjet<number[]>().
        default(() => []).
        with(a => a || []).
        declare();

    readonlyArray = propjet<number[]>().
        get(() => this.readonlyArray || []).
        declare();

    defaultOption = propjet<string>().
        default(() => "on").
        declare();

    arrayLength = propjet<number>().
        require(() => this.array).
        get(
        a =>
        {
            this.callCount++;
            return a.length;
        }).
        declare();

    filterValue = propjet<number>().
        with((newValue, oldValue) => newValue || oldValue).
        declare();

    initializableValue = propjet<number>().
        require(() => this.backingValue).
        default(() => 0).
        declare();
}

describe("propjet",() =>
{
    var obj: TestClass;

    beforeEach(() =>
    {
        obj = new TestClass();
    });

    it("supports simple getters",() =>
    {
        obj.backingValue = 1;
        expect(obj.simpleGet).toBe(1);
        obj.backingValue = 2;
        expect(obj.simpleGet).toBe(2);
    });

    it("supports lazy loading via empty requirements ",() =>
    {
        expect(obj.callCount).toBe(0);
        expect(obj.fibonacciNumbers).toBe(obj.fibonacciNumbers);
        expect(obj.callCount).toBe(1);
    });

    it("expects explicit invalidation on complex requirement change",() =>
    {
        obj.backingObject = new TestClass();
        obj.backingObject.backingValue = 1;
        expect(obj.objectValue).toBe(1);
        obj.backingObject.backingValue = 2;
        expect(obj.objectValue).toBe(1);
        propjet.invalidate(obj.backingObject);
        expect(obj.objectValue).toBe(2);
        obj.backingObject.backingValue = 3;
        propjet.invalidate(obj.backingObject);
        expect(obj.objectValue).toBe(3);
    });

    it("expects explicit invalidation on function requirement change",() =>
    {
        var i = 1;
        obj.backingFunction = () => i;
        expect(obj.functionValue).toBe(1);
        i = 2;
        expect(obj.functionValue).toBe(1);
        propjet.invalidate(obj.backingFunction);
        expect(obj.functionValue).toBe(2);
    });

    it("does not need invalidation on requirement length change",() =>
    {
        expect(obj.arrayLength).toBe(0);
        obj.array.push(0);
        expect(obj.arrayLength).toBe(1);
    });

    it("allows getting last read value in getter",() =>
    {
        expect(obj.readonlyArray).toBe(obj.readonlyArray);
    });

    it("allows change default value",() =>
    {
        expect(obj.defaultOption).toBe("on");
        obj.defaultOption = null;
        expect(obj.defaultOption).toBeNull();
    });

    it("filters written values",() =>
    {
        expect(obj.filterValue).toBeUndefined();
        obj.filterValue = 1;
        expect(obj.filterValue).toBe(1);
        obj.filterValue = null;
        expect(obj.filterValue).toBe(1);
        obj.filterValue = 2;
        expect(obj.filterValue).toBe(2);
    });

    it("allows property overriding",() =>
    {
        var a = [];
        expect(obj.readonlyArray).toBeDefined();
        obj.readonlyArray = propjet<number[]>().default(() => []).declare();
        obj.readonlyArray = a;
        expect(obj.readonlyArray).toBe(a);
    });

    it("throws error on writing readonly property",() =>
    {
        expect(() => obj.readonlyArray = []).toThrowError("Attempt to write readonly property");
    });

    it("throws error on circular dependency",() =>
    {
        var v;
        propjet<number>(obj, "x").get(() => obj.functionValue).declare();
        obj.backingFunction = () => (<any>obj).x;
        expect(() => v = obj.functionValue).toThrowError("Circular dependency detected");
    });

    it("throws error on recursive property write",() =>
    {
        obj.backingFunction = (x: number) => obj.functionValue = x;
        expect(() => obj.functionValue = 1).toThrowError("Recursive property write");
    });

    it("has alias for 'with' method",() =>
    {
        var p = propjet<any>();
        expect(p.with).toBeDefined();
        expect(p.with).toBe(p.withal);
    });

    it("treats NaN values as equal",() =>
    {
        obj.backingValue = NaN;
        expect(obj.cacheGet).toBeNaN();
        expect(obj.callCount).toBe(1);
        obj.backingValue = 0 / 0;
        expect(obj.cacheGet).toBeNaN();
        expect(obj.callCount).toBe(1);
    });

    it("treats undefined and null as different values",() =>
    {
        obj.backingValue = null;
        expect(obj.cacheGet).toBeNull();
        obj.backingValue = undefined;
        expect(obj.cacheGet).toBeUndefined();
    });

    it("treats empty arrays as equal",() =>
    {
        obj.array = [];
        expect(obj.arrayLength).toBe(0);
        obj.array = [];
        expect(obj.arrayLength).toBe(0);
        expect(obj.callCount).toBe(1);
        propjet.invalidate(obj.array);
        expect(obj.arrayLength).toBe(0);
        expect(obj.callCount).toBe(2);
        obj.array = [1];
        expect(obj.arrayLength).toBe(1);
        expect(obj.callCount).toBe(3);
    });

    it("reinitializes property on requirement change",() =>
    {
        expect(obj.initializableValue).toBe(0);
        obj.initializableValue = 2;
        expect(obj.initializableValue).toBe(2);
        obj.backingValue = 1;
        expect(obj.initializableValue).toBe(0);
    });

    it("does not initialize property after implicit setting",() =>
    {
        obj.backingValue = 1;
        obj.initializableValue = 2;
        expect(obj.initializableValue).toBe(2);
        obj.backingValue = 2;
        expect(obj.initializableValue).toBe(0);
    });
});